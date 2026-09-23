const THEMES = ['theme1', 'theme2', 'theme3', 'theme4'];

let startTime;
let timerInterval;
let fullBoard;
let puzzleBoard;
let currentDifficulty = 'moyen';
let celluleSelectionnee = null;
let modeNotesActive = false;

// --- GESTION DES THÈMES ---
function choisirThemeAleatoire() {
    const themeIndex = Math.floor(Math.random() * THEMES.length);
    const themeSelectionne = THEMES[themeIndex];
    
    document.body.className = themeSelectionne;
    
    const logoImg = document.getElementById("logo-img");
    if (logoImg) {
        logoImg.src = `${themeSelectionne}/logo.png`;
    }
}

// --- INITIALISATION DATE ---
function initialiserPartie() {
    choisirThemeAleatoire();
    
    let d = new Date();
    let options = { day: 'numeric', month: 'long', year: 'numeric' };
    let dateStr = d.toLocaleDateString('fr-FR', options).toLowerCase();
    document.getElementById("date-text").innerText = dateStr;
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    startTime = Date.now();
    timerInterval = setInterval(() => {
        let elapsed = Math.floor((Date.now() - startTime) / 1000);
        let m = Math.floor(elapsed / 60).toString().padStart(2, '0');
        let s = (elapsed % 60).toString().padStart(2, '0');
        document.getElementById("timer").innerText = `${m}:${s}`;
    }, 1000);
}

// --- GÉNÉRATION DU SUDOKU ---
// Principe :
//   1. un générateur aléatoire déterministe, initialisé à partir de la date ET de la
//      difficulté (même grille pour tout le monde, sur tous les navigateurs) ;
//   2. une grille complète tirée au hasard ;
//   3. on retire les cases une par une. Un retrait n'est validé que si :
//        - la grille garde UNE SEULE solution (solveur par retour arrière) ;
//        - elle reste résoluble par le "solveur humain" (voir plus bas) sans dépasser
//          le niveau de technique autorisé pour la difficulté ;
//   4. la grille finale n'est acceptée que si elle EXIGE le niveau visé : un "moyen"
//      qui se résout uniquement avec des candidats uniques est rejeté, et on recommence.

// niveau  : niveau de technique que la grille doit exiger (1, 2 ou 3, voir TECHNIQUES)
// retirer : [min, max] de cases retirées
const DIFFICULTES = {
    facile:    { niveau: 1, retirer: [36, 40] },
    moyen:     { niveau: 2, retirer: [44, 52] },
    difficile: { niveau: 3, retirer: [48, 58] }
};
// Nombre maximum de grilles complètes essayées avant de se rabattre sur la meilleure trouvée
const ESSAIS_MAX = 150;

// Transforme un texte en entier 32 bits (hash xmur3)
function hashTexte(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
}

// Générateur pseudo-aléatoire mulberry32 : renvoie une fonction qui donne un nombre dans [0, 1[
function creerAleatoire(graine) {
    let a = graine >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function entierAleatoire(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
}

// Mélange de Fisher-Yates : non biaisé et identique sur tous les navigateurs
// (contrairement à sort(() => hasard - 0.5), dont le résultat dépend du moteur JS)
function melanger(tableau, rng) {
    for (let i = tableau.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [tableau[i], tableau[j]] = [tableau[j], tableau[i]];
    }
    return tableau;
}

function nombreDeBits(masque) {
    let n = 0;
    while (masque) { masque &= masque - 1; n++; }
    return n;
}

// Solveur par retour arrière. "grille" est un tableau plat de 81 cases (0 = vide).
//  - sans rng : compte les solutions et s'arrête dès que "limite" est atteinte ;
//  - avec rng : essaie les chiffres dans un ordre aléatoire (sert à créer la grille complète).
// Renvoie { nombre, solution } (solution = première solution trouvée).
function resoudre(grille, limite, rng) {
    const g = grille.slice();
    const lignes = new Array(9).fill(0);
    const colonnes = new Array(9).fill(0);
    const blocs = new Array(9).fill(0);

    for (let i = 0; i < 81; i++) {
        if (g[i] !== 0) {
            const bit = 1 << (g[i] - 1);
            const r = Math.floor(i / 9), c = i % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
            // Grille de départ incohérente (doublon) : aucune solution
            if ((lignes[r] | colonnes[c] | blocs[b]) & bit) return { nombre: 0, solution: null };
            lignes[r] |= bit; colonnes[c] |= bit; blocs[b] |= bit;
        }
    }

    let nombre = 0;
    let solution = null;

    function explorer() {
        // On choisit la case vide qui a le moins de candidats : c'est ce qui rend le solveur rapide
        let meilleure = -1, meilleurMasque = 0, meilleurNb = 10;
        for (let i = 0; i < 81; i++) {
            if (g[i] !== 0) continue;
            const r = Math.floor(i / 9), c = i % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
            const masque = ~(lignes[r] | colonnes[c] | blocs[b]) & 0x1FF;
            if (masque === 0) return; // case impossible à remplir : impasse
            const nb = nombreDeBits(masque);
            if (nb < meilleurNb) {
                meilleure = i; meilleurMasque = masque; meilleurNb = nb;
                if (nb === 1) break;
            }
        }

        if (meilleure === -1) { // plus aucune case vide : une solution de plus
            nombre++;
            if (!solution) solution = g.slice();
            return;
        }

        const r = Math.floor(meilleure / 9), c = meilleure % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        const candidats = [];
        for (let n = 1; n <= 9; n++) if (meilleurMasque & (1 << (n - 1))) candidats.push(n);
        if (rng) melanger(candidats, rng);

        for (const n of candidats) {
            const bit = 1 << (n - 1);
            g[meilleure] = n;
            lignes[r] |= bit; colonnes[c] |= bit; blocs[b] |= bit;
            explorer();
            g[meilleure] = 0;
            lignes[r] &= ~bit; colonnes[c] &= ~bit; blocs[b] &= ~bit;
            if (nombre >= limite) return;
        }
    }

    explorer();
    return { nombre, solution };
}

function aUneSolutionUnique(grille) {
    return resoudre(grille, 2).nombre === 1;
}

function genererGrilleComplete(rng) {
    return resoudre(new Array(81).fill(0), 1, rng).solution;
}

// --- SOLVEUR HUMAIN ---
// Résout une grille uniquement par déduction, comme le ferait un joueur, en travaillant sur
// les candidats de chaque case (un masque de 9 bits : bit n-1 allumé = le chiffre n est possible).
// Il essaie toujours la technique la plus simple d'abord ; le "niveau" d'une grille est donc
// celui de la technique la plus difficile dont on ne peut pas se passer.

// Les 27 unités (9 lignes, 9 colonnes, 9 blocs) et, pour chaque case, ses 20 voisines
const UNITES = [];
for (let r = 0; r < 9; r++) UNITES.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
for (let c = 0; c < 9; c++) UNITES.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
for (let b = 0; b < 9; b++) {
    const r0 = Math.floor(b / 3) * 3, c0 = (b % 3) * 3;
    UNITES.push(Array.from({ length: 9 }, (_, k) => (r0 + Math.floor(k / 3)) * 9 + c0 + (k % 3)));
}
const LIGNES_ET_COLONNES = UNITES.slice(0, 18);
const BLOCS = UNITES.slice(18);

// Toutes les intersections bloc/ligne et bloc/colonne, dans les deux sens (pour les candidats verrouillés) :
// source = cases de la première unité (avec un drapeau "commun"), reste = cases de la seconde hors intersection
const INTERSECTIONS = [];
for (const bloc of BLOCS) for (const ligne of LIGNES_ET_COLONNES) {
    if (!bloc.some(i => ligne.includes(i))) continue;
    for (const [a, b] of [[bloc, ligne], [ligne, bloc]]) {
        INTERSECTIONS.push({
            source: a.map(i => ({ i, commun: b.includes(i) })),
            reste: b.filter(j => !a.includes(j))
        });
    }
}

const SONT_VOISINES = Array.from({ length: 81 }, () => new Uint8Array(81));
for (const unite of UNITES) for (const i of unite) for (const j of unite) if (i !== j) SONT_VOISINES[i][j] = 1;
const VOISINES = SONT_VOISINES.map(ligne => Array.from(ligne.keys()).filter(j => ligne[j]));

function creerEtat(grille) {
    const etat = { val: new Array(81).fill(0), cand: new Array(81).fill(0x1FF), vides: 81 };
    for (let i = 0; i < 81; i++) if (grille[i] !== 0) poser(etat, i, grille[i]);
    return etat;
}

function poser(etat, i, n) {
    const bit = 1 << (n - 1);
    etat.val[i] = n;
    etat.cand[i] = 0;
    etat.vides--;
    for (const j of VOISINES[i]) etat.cand[j] &= ~bit;
}

// Retire des candidats d'une case ; renvoie true si quelque chose a changé
function eliminer(etat, i, masque) {
    if ((etat.cand[i] & masque) === 0) return false;
    etat.cand[i] &= ~masque;
    return true;
}

// Appelle fn(combinaison) pour chaque choix de k éléments ; s'arrête si fn renvoie true
function pourChaqueCombinaison(elements, k, fn) {
    const choix = [];
    function rec(debut) {
        if (choix.length === k) return fn(choix);
        for (let i = debut; i <= elements.length - (k - choix.length); i++) {
            choix.push(elements[i]);
            if (rec(i + 1)) return true;
            choix.pop();
        }
        return false;
    }
    return rec(0);
}

// NIVEAU 1 -- Candidat unique caché : dans une unité, un chiffre n'a plus qu'une case possible
function candidatUniqueCache(etat) {
    let progres = false;
    for (const unite of UNITES) {
        for (let n = 1; n <= 9; n++) {
            const bit = 1 << (n - 1);
            let nb = 0, ou = -1;
            for (const i of unite) if (etat.cand[i] & bit) { nb++; ou = i; }
            if (nb === 1) { poser(etat, ou, n); progres = true; }
        }
    }
    return progres;
}

// NIVEAU 1 -- Candidat unique nu : une case n'a plus qu'un seul chiffre possible
function candidatUniqueNu(etat) {
    let progres = false;
    for (let i = 0; i < 81; i++) {
        const m = etat.cand[i];
        if (etat.val[i] === 0 && m !== 0 && (m & (m - 1)) === 0) {
            poser(etat, i, 32 - Math.clz32(m));
            progres = true;
        }
    }
    return progres;
}

// NIVEAU 2 -- Candidats verrouillés (paires/triplets pointants et réduction ligne-bloc) :
// si, dans une unité, un chiffre n'est possible que dans des cases qui appartiennent toutes
// à une même autre unité, on peut le retirer du reste de cette autre unité.
function candidatsVerrouilles(etat) {
    let progres = false;
    for (const { source, reste } of INTERSECTIONS) {
        for (let n = 1; n <= 9; n++) {
            const bit = 1 << (n - 1);
            let dansCommun = 0, horsCommun = 0;
            for (const { i, commun } of source) {
                if (etat.cand[i] & bit) { if (commun) dansCommun++; else horsCommun++; }
            }
            if (dansCommun < 2 || horsCommun > 0) continue;
            for (const j of reste) if (eliminer(etat, j, bit)) progres = true;
        }
    }
    return progres;
}

// Sous-ensemble nu de taille k (paire, triplet, quadruplet nus) : k cases d'une unité se
// partagent exactement k candidats -> ces chiffres sont exclus des autres cases de l'unité.
function sousEnsembleNu(etat, k) {
    let progres = false;
    for (const unite of UNITES) {
        const cases = unite.filter(i => etat.val[i] === 0 && nombreDeBits(etat.cand[i]) <= k);
        if (cases.length < k) continue;
        pourChaqueCombinaison(cases, k, choix => {
            let union = 0;
            for (const i of choix) union |= etat.cand[i];
            if (nombreDeBits(union) !== k) return false;
            for (const j of unite) if (!choix.includes(j) && eliminer(etat, j, union)) progres = true;
            return false;
        });
    }
    return progres;
}

// Sous-ensemble caché de taille k : k chiffres d'une unité ne sont possibles que dans les
// mêmes k cases -> on retire tous les autres candidats de ces cases.
function sousEnsembleCache(etat, k) {
    let progres = false;
    for (const unite of UNITES) {
        const positions = {}; // chiffre -> masque des positions possibles dans l'unité
        const chiffres = [];
        for (let n = 1; n <= 9; n++) {
            const bit = 1 << (n - 1);
            let m = 0;
            unite.forEach((i, p) => { if (etat.cand[i] & bit) m |= 1 << p; });
            if (m !== 0 && nombreDeBits(m) <= k) { positions[n] = m; chiffres.push(n); }
        }
        if (chiffres.length < k) continue;
        pourChaqueCombinaison(chiffres, k, choix => {
            let union = 0, masqueChiffres = 0;
            for (const n of choix) { union |= positions[n]; masqueChiffres |= 1 << (n - 1); }
            if (nombreDeBits(union) !== k) return false;
            unite.forEach((i, p) => {
                if ((union & (1 << p)) && eliminer(etat, i, ~masqueChiffres & 0x1FF)) progres = true;
            });
            return false;
        });
    }
    return progres;
}

// Poisson de taille k (2 = X-Wing, 3 = Swordfish) : si, dans k lignes, un chiffre n'est
// possible que dans les mêmes k colonnes, on le retire de ces colonnes dans les autres lignes
// (et inversement en échangeant lignes et colonnes).
function poisson(etat, k) {
    let progres = false;
    for (const enLignes of [true, false]) {
        const indice = (a, b) => enLignes ? a * 9 + b : b * 9 + a;
        for (let n = 1; n <= 9; n++) {
            const bit = 1 << (n - 1);
            const masques = [];
            const rangees = [];
            for (let a = 0; a < 9; a++) {
                let m = 0;
                for (let b = 0; b < 9; b++) if (etat.cand[indice(a, b)] & bit) m |= 1 << b;
                masques.push(m);
                const nb = nombreDeBits(m);
                if (nb >= 2 && nb <= k) rangees.push(a);
            }
            if (rangees.length < k) continue;
            pourChaqueCombinaison(rangees, k, choix => {
                let union = 0;
                for (const a of choix) union |= masques[a];
                if (nombreDeBits(union) !== k) return false;
                for (let a = 0; a < 9; a++) {
                    if (choix.includes(a)) continue;
                    for (let b = 0; b < 9; b++) {
                        if ((union & (1 << b)) && eliminer(etat, indice(a, b), bit)) progres = true;
                    }
                }
                return false;
            });
        }
    }
    return progres;
}

// XY-Wing : un pivot {x,y} voit deux pinces {x,z} et {y,z} -> l'une des deux pinces vaut
// forcément z, donc z est exclu de toute case qui voit les deux pinces.
function xyWing(etat) {
    let progres = false;
    const bivalues = [];
    for (let i = 0; i < 81; i++) if (nombreDeBits(etat.cand[i]) === 2) bivalues.push(i);

    for (const pivot of bivalues) {
        const pinces = bivalues.filter(i => SONT_VOISINES[pivot][i]);
        for (const p1 of pinces) for (const p2 of pinces) {
            if (p1 >= p2) continue;
            const mp = etat.cand[pivot], m1 = etat.cand[p1], m2 = etat.cand[p2];
            if (nombreDeBits(mp) !== 2 || nombreDeBits(m1) !== 2 || nombreDeBits(m2) !== 2) continue; // modifié entre-temps
            const z = m1 & m2;
            if (nombreDeBits(z) !== 1 || (z & mp) !== 0) continue;   // un seul chiffre commun, absent du pivot
            if (((m1 | m2) & ~z) !== mp) continue;                  // les deux autres chiffres sont ceux du pivot
            for (let j = 0; j < 81; j++) {
                if (SONT_VOISINES[p1][j] && SONT_VOISINES[p2][j] && eliminer(etat, j, z)) progres = true;
            }
        }
    }
    return progres;
}

// Les techniques connues, de la plus simple à la plus difficile. Pour changer ce que veut dire
// "moyen" ou "difficile", il suffit de changer le niveau d'une technique ici.
const TECHNIQUES = [
    { nom: "candidat unique caché",      niveau: 1, appliquer: candidatUniqueCache },
    { nom: "candidat unique nu",         niveau: 1, appliquer: candidatUniqueNu },
    { nom: "candidats verrouillés",      niveau: 2, appliquer: candidatsVerrouilles },
    { nom: "paire nue",                  niveau: 2, appliquer: e => sousEnsembleNu(e, 2) },
    { nom: "paire cachée",               niveau: 2, appliquer: e => sousEnsembleCache(e, 2) },
    { nom: "triplet nu",                 niveau: 2, appliquer: e => sousEnsembleNu(e, 3) },
    { nom: "triplet caché",              niveau: 3, appliquer: e => sousEnsembleCache(e, 3) },
    { nom: "quadruplet nu",              niveau: 3, appliquer: e => sousEnsembleNu(e, 4) },
    { nom: "x-wing",                     niveau: 3, appliquer: e => poisson(e, 2) },
    { nom: "xy-wing",                    niveau: 3, appliquer: xyWing },
    { nom: "swordfish",                  niveau: 3, appliquer: e => poisson(e, 3) }
].sort((a, b) => a.niveau - b.niveau);

// Renvoie { resolu, niveau, techniques } :
//   resolu     : la grille se résout-elle entièrement avec les techniques de niveau <= niveauMax ?
//   niveau     : niveau de la technique la plus difficile qu'il a fallu utiliser
//   techniques : { nom de la technique : nombre d'utilisations }
function resoudreCommeUnHumain(grille, niveauMax = 3) {
    const etat = creerEtat(grille);
    const techniques = {};
    let niveau = 0;

    while (etat.vides > 0) {
        let progres = false;
        for (const t of TECHNIQUES) {
            if (t.niveau > niveauMax) break;
            if (t.appliquer(etat)) {
                techniques[t.nom] = (techniques[t.nom] || 0) + 1;
                niveau = Math.max(niveau, t.niveau);
                progres = true;
                break; // on repart toujours de la technique la plus simple
            }
        }
        if (!progres) return { resolu: false, niveau, techniques };
    }
    return { resolu: true, niveau, techniques };
}

// --- CREUSAGE ---
// Retire des cases dans un ordre aléatoire. Un retrait est annulé s'il crée plusieurs solutions
// ou si la grille ne se résout plus avec les techniques de niveau <= config.niveau.
// On s'arrête quand l'objectif est atteint ET que la grille exige le niveau visé
// (ou quand on atteint le maximum de cases retirées).
function creuserGrille(complete, config, objectif, rng) {
    const puzzle = complete.slice();
    const positions = melanger(Array.from({ length: 81 }, (_, i) => i), rng);
    let retirees = 0, niveau = 0, techniques = {};

    for (const pos of positions) {
        if (retirees >= config.retirer[1]) break;
        if (retirees >= objectif && niveau >= config.niveau) break;

        const valeur = puzzle[pos];
        puzzle[pos] = 0;
        const analyse = aUneSolutionUnique(puzzle) ? resoudreCommeUnHumain(puzzle, config.niveau) : null;
        if (analyse && analyse.resolu) {
            retirees++;
            niveau = analyse.niveau;
            techniques = analyse.techniques;
        } else {
            puzzle[pos] = valeur; // retrait refusé : on remet le chiffre
        }
    }
    return { puzzle, retirees, niveau, techniques };
}

function enLignes(plat) {
    return Array.from({ length: 9 }, (_, r) => plat.slice(r * 9, r * 9 + 9));
}

// Point d'entrée : renvoie { solution, puzzle, niveau, techniques } pour une date et une difficulté
// (solution et puzzle sont des tableaux 9x9). Même date + même difficulté = toujours la même grille.
function genererGrille(date, difficulty) {
    const cle = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${difficulty}`;
    const rng = creerAleatoire(hashTexte(cle));
    const config = DIFFICULTES[difficulty] || DIFFICULTES.moyen;
    const objectif = entierAleatoire(rng, config.retirer[0], config.retirer[1]);

    let meilleur = null;
    for (let essai = 0; essai < ESSAIS_MAX; essai++) {
        const complete = genererGrilleComplete(rng);
        const r = creuserGrille(complete, config, objectif, rng);
        const reussi = r.niveau === config.niveau && r.retirees >= config.retirer[0];
        // Solution de repli si aucun essai ne réussit : le niveau le plus proche, puis le plus de cases retirées.
        // (Dans tous les cas la grille a une solution unique et se résout sans deviner.)
        const score = (reussi ? 100000 : 0) + r.niveau * 1000 + r.retirees;
        if (!meilleur || score > meilleur.score) meilleur = { ...r, complete, score, reussi };
        if (reussi) break;
    }

    return {
        solution: enLignes(meilleur.complete),
        puzzle: enLignes(meilleur.puzzle),
        niveau: meilleur.niveau,
        techniques: meilleur.techniques,
        conforme: meilleur.reussi
    };
}

// --- RENDU ET INTERACTIONS ---
function chargerJeu(difficulty) {
    currentDifficulty = difficulty;
    
    document.querySelectorAll('.difficulty-selector button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${difficulty}`).classList.add('active');

    const grille = genererGrille(new Date(), difficulty);
    fullBoard = grille.solution;
    puzzleBoard = grille.puzzle;
    // Pour vérifier la génération : techniques nécessaires à la grille du jour (F12 > Console)
    console.info(`sudoku ${difficulty} : niveau ${grille.niveau}${grille.conforme ? "" : " (niveau visé non atteint)"}`, grille.techniques);
    
    renderBoard();
    startTimer();
    document.getElementById("victory-message").style.display = "none";
    celluleSelectionnee = null;
}

function renderBoard() {
    const boardDiv = document.getElementById("board");
    boardDiv.innerHTML = "";
    
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            let cellDiv = document.createElement("div");
            cellDiv.className = "cell";
            cellDiv.dataset.row = r;
            cellDiv.dataset.col = c;
            
            let notesGrid = document.createElement("div");
            notesGrid.className = "notes-grid";
            for(let i = 1; i <= 9; i++) {
                let noteSpan = document.createElement("span");
                noteSpan.className = `note-${i}`;
                noteSpan.innerText = i;
                notesGrid.appendChild(noteSpan);
            }
            
            let mainVal = document.createElement("div");
            mainVal.className = "main-value";

            if (puzzleBoard[r][c] !== 0) {
                mainVal.innerText = puzzleBoard[r][c];
                cellDiv.classList.add("readonly");
            } else {
                cellDiv.addEventListener("click", function(e) {
                    e.stopPropagation();
                    deselectionnerToutes();
                    this.classList.add("selected");
                    celluleSelectionnee = this;
                    updateSubgridBorders();
                });
            }

            cellDiv.appendChild(notesGrid);
            cellDiv.appendChild(mainVal);
            boardDiv.appendChild(cellDiv);
        }
    }

    updateSubgridBorders();
}

function isDark(cell) {
    if (!cell) return false;
    return cell.classList.contains("readonly") || cell.classList.contains("selected");
}

function updateSubgridBorders() {
    if (!document.body.classList.contains("theme1")) return;

    const cells = document.getElementById("board").children;
    if (!cells || cells.length !== 81) return;

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            let cellA = cells[r * 9 + c];

            if (c === 2 || c === 5) {
                let cellB = cells[r * 9 + (c + 1)];
                if (isDark(cellA) && isDark(cellB)) {
                    cellA.classList.add("subgrid-border-right-yellow");
                } else {
                    cellA.classList.remove("subgrid-border-right-yellow");
                }
            }

            if (r === 2 || r === 5) {
                let cellB = cells[(r + 1) * 9 + c];
                if (isDark(cellA) && isDark(cellB)) {
                    cellA.classList.add("subgrid-border-bottom-yellow");
                } else {
                    cellA.classList.remove("subgrid-border-bottom-yellow");
                }
            }
        }
    }
}

function toggleNotes() {
    modeNotesActive = !modeNotesActive;
    const btn = document.getElementById("btn-notes");
    btn.innerText = modeNotesActive ? "mode notes activé" : "mode notes désactivé";
    btn.classList.toggle("active", modeNotesActive);
}

function effacerNotesLiees(row, col, num) {
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;

    document.querySelectorAll('.cell:not(.readonly)').forEach(cell => {
        let r = parseInt(cell.dataset.row);
        let c = parseInt(cell.dataset.col);
        
        if (r === row || c === col || (r >= startRow && r < startRow + 3 && c >= startCol && c < startCol + 3)) {
            let note = cell.querySelector(`.note-${num}`);
            if (note) note.classList.remove('visible');
        }
    });
}

function saisirChiffre(num) {
    if (!celluleSelectionnee || celluleSelectionnee.classList.contains("readonly")) return;

    let mainVal = celluleSelectionnee.querySelector(".main-value");
    
    if (modeNotesActive) {
        if (mainVal.innerText !== "") return;
        let noteSpan = celluleSelectionnee.querySelector(`.note-${num}`);
        noteSpan.classList.toggle("visible");
    } else {
        let r = parseInt(celluleSelectionnee.dataset.row);
        let c = parseInt(celluleSelectionnee.dataset.col);

        if (mainVal.innerText == num) {
            effacerCase();
            return;
        }

        mainVal.innerText = num;
        celluleSelectionnee.querySelectorAll(".notes-grid span").forEach(s => s.classList.remove("visible"));
        effacerNotesLiees(r, c, num);
        
        checkWin();
    }
}

function effacerCase() {
    if (!celluleSelectionnee || celluleSelectionnee.classList.contains("readonly")) return;
    celluleSelectionnee.querySelector(".main-value").innerText = "";
    celluleSelectionnee.querySelectorAll(".notes-grid span").forEach(s => s.classList.remove("visible"));
}

function clearAll() {
    if(confirm("Voulez-vous vraiment effacer toute votre progression ?")) {
        document.querySelectorAll('.cell:not(.readonly)').forEach(cell => {
            cell.querySelector(".main-value").innerText = "";
            cell.querySelectorAll(".notes-grid span").forEach(s => s.classList.remove("visible"));
        });
    }
}

function deselectionnerToutes() {
    document.querySelectorAll('.cell').forEach(c => c.classList.remove("selected"));
    updateSubgridBorders();
}

window.addEventListener("keydown", function(e) {
    if (e.key.toLowerCase() === 'n') {
        toggleNotes();
        return;
    }

    if (!celluleSelectionnee || celluleSelectionnee.classList.contains("readonly")) return;

    if (/[1-9]/.test(e.key)) {
        saisirChiffre(parseInt(e.key));
    } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        effacerCase();
    }
});

document.addEventListener("click", function(e) {
    const board = document.getElementById("board");
    const numpad = document.querySelector(".numpad");
    const btnNotes = document.getElementById("btn-notes");
    
    if (!board.contains(e.target) && !numpad.contains(e.target) && e.target !== btnNotes) {
        deselectionnerToutes();
        celluleSelectionnee = null;
    }
});

function checkWin() {
    let inputs = document.querySelectorAll('.cell');
    for (let i = 0; i < 81; i++) {
        let r = Math.floor(i / 9);
        let c = i % 9;
        let val = inputs[i].querySelector(".main-value").innerText;
        
        if (val === "" || parseInt(val) !== fullBoard[r][c]) {
            return;
        }
    }
    
    clearInterval(timerInterval);
    let msg = document.getElementById("victory-message");
    msg.innerText = `félicitations ! résolu en ${document.getElementById("timer").innerText}`;
    msg.style.display = "block";
}

// --- DÉMARRAGE DU JEU ---
initialiserPartie();
chargerJeu('moyen');


// --- EASTER EGG : IMPRESSION 8 GRILLES EN PDF A3 ---
document.getElementById('logo-img').addEventListener('dblclick', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const inputDate = prompt("Easter Egg activé !\nEntrez la date de début (AAAA-MM-JJ) :", todayStr);
    
    if (!inputDate) return;

    const parts = inputDate.split('-');
    if (parts.length !== 3) {
        alert("Format de date invalide.");
        return;
    }
    const startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

    if (isNaN(startDate.getTime())) {
        alert("Format de date invalide.");
        return;
    }

    const activeDiffBtn = document.querySelector('.difficulty-selector button.active');
    const difficulty = activeDiffBtn ? activeDiffBtn.textContent.trim().toLowerCase() : currentDifficulty;
    const currentThemeClass = document.body.className;

    // 1. Sauvegarde des styles du body
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyHeight = document.body.style.height;
    const originalBodyDisplay = document.body.style.display;
    const originalBodyPadding = document.body.style.padding;
    const originalBodyMargin = document.body.style.margin;

    // 2. Masquage temporaire de l'interface
    const childrenToHide = Array.from(document.body.children);
    childrenToHide.forEach(el => el.style.display = 'none');

    // 3. Préparation du document pour html2canvas
    window.scrollTo(0, 0);
    document.body.style.overflow = 'visible';
    document.body.style.height = 'auto';
    document.body.style.display = 'block';
    document.body.style.padding = '0';
    document.body.style.margin = '0';

    const pdfPage = document.createElement('div');
    pdfPage.className = `pdf-page ${currentThemeClass}`;

    // Génération de 8 grilles au lieu de 9
    for (let i = 0; i < 8; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        const formattedDate = currentDate.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        const puzzleData = genererGrille(currentDate, difficulty).puzzle.flat();

        const gridCard = document.createElement('div');
        gridCard.className = 'pdf-grid-card';
        gridCard.innerHTML = `
        <div class="pdf-header">
            <img src="${currentThemeClass}/logo_nb.png" class="pdf-logo" alt="Logo">
            <div class="pdf-info-row">
                <span class="pdf-date">${formattedDate}</span>
                <span class="pdf-badge-difficulty">${difficulty}</span>
            </div>
        </div>
        <div class="sudoku-board"></div>
        `;

        const boardContainer = gridCard.querySelector('.sudoku-board');

        puzzleData.forEach((val, idx) => {
            const cell = document.createElement('div');
            const row = Math.floor(idx / 9);
            const col = idx % 9;

            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;

            if (val !== 0) {
                cell.classList.add('readonly');
                cell.innerHTML = `<span class="main-value">${val}</span>`;
            }

            boardContainer.appendChild(cell);
        });

        if (currentThemeClass === 'theme1') {
            const cells = boardContainer.children;
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    const idxA = r * 9 + c;
                    if ((c === 2 || c === 5) && puzzleData[idxA] !== 0 && puzzleData[idxA + 1] !== 0) {
                        cells[idxA].classList.add('border-right-white');
                    }
                    if ((r === 2 || r === 5) && puzzleData[idxA] !== 0 && puzzleData[idxA + 9] !== 0) {
                        cells[idxA].classList.add('border-bottom-white');
                    }
                }
            }
        }

        pdfPage.appendChild(gridCard);
    }

    // Repères de coupe : un trait à chaque extrémité de chaque ligne de coupe
    // (5 lignes verticales pour 4 colonnes, 3 lignes horizontales pour 2 rangées)
    for (let k = 0; k <= 4; k++) {
        for (const cote of ['haut', 'bas']) {
            const repere = document.createElement('div');
            repere.className = `pdf-repere-v ${cote}`;
            repere.style.setProperty('--k', k);
            pdfPage.appendChild(repere);
        }
    }
    for (let k = 0; k <= 2; k++) {
        for (const cote of ['gauche', 'droite']) {
            const repere = document.createElement('div');
            repere.className = `pdf-repere-h ${cote}`;
            repere.style.setProperty('--k', k);
            pdfPage.appendChild(repere);
        }
    }

    document.body.appendChild(pdfPage);

    await new Promise(resolve => setTimeout(resolve, 150));

    const options = {
        margin: 0,
        filename: `sudoku-8-grilles-${inputDate}.pdf`,
        image: { type: 'png' },
        html2canvas: { 
            scale: 3.5, // 2.5 évite la saturation mémoire sur du format A3
            logging: false,
            useCORS: true,
            scrollX: 0,
            scrollY: 0
        },
        jsPDF: { unit: 'mm', format: 'a3', orientation: 'landscape', compress: false },
        pagebreak: { mode: 'avoid-all' }
    };

    try {
        await html2pdf().set(options).from(pdfPage).save();
    } catch (err) {
        console.error("Erreur lors de la génération du PDF :", err);
    } finally {
        if (document.body.contains(pdfPage)) {
            document.body.removeChild(pdfPage);
        }
        childrenToHide.forEach(el => el.style.display = '');
        document.body.style.overflow = originalBodyOverflow;
        document.body.style.height = originalBodyHeight;
        document.body.style.display = originalBodyDisplay;
        document.body.style.padding = originalBodyPadding;
        document.body.style.margin = originalBodyMargin;
    }
});