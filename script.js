const THEMES = ['theme1', 'theme2', 'theme3', 'theme4'];

let startTime;
let timerInterval;
let seed;
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

// --- INITIALISATION DATE ET SEED ---
function initialiserPartie() {
    choisirThemeAleatoire();
    
    let d = new Date();
    let options = { day: 'numeric', month: 'long', year: 'numeric' };
    let dateStr = d.toLocaleDateString('fr-FR', options).toLowerCase();
    document.getElementById("date-text").innerText = dateStr;
    
    seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
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
function lcg() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
}

function randInt(min, max) {
    return Math.floor(lcg() * (max - min + 1)) + min;
}

function generateFullBoard() {
    let board = Array.from({length: 9}, () => Array(9).fill(0));
    
    function fillBoard() {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === 0) {
                    let nums = [1,2,3,4,5,6,7,8,9];
                    nums.sort(() => lcg() - 0.5);
                    for (let n of nums) {
                        if (isValid(board, r, c, n)) {
                            board[r][c] = n;
                            if (fillBoard()) return true;
                            board[r][c] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }
    fillBoard();
    return board;
}

function isValid(board, r, c, num) {
    for (let i = 0; i < 9; i++) {
        if (board[r][i] === num || board[i][c] === num) return false;
    }
    let br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (board[br + i][bc + j] === num) return false;
        }
    }
    return true;
}

function createPuzzle(full, difficulty) {
    let puzzle = full.map(row => [...row]);
    let cellsToRemove = difficulty === 'facile' ? randInt(30, 40) : difficulty === 'moyen' ? randInt(41, 50) : randInt(51, 60);
    
    let positions = [];
    for(let i=0; i<81; i++) positions.push(i);
    positions.sort(() => lcg() - 0.5);

    for (let i = 0; i < cellsToRemove; i++) {
        let r = Math.floor(positions[i] / 9);
        let c = positions[i] % 9;
        puzzle[r][c] = 0;
    }
    return puzzle;
}

// --- RENDU ET INTERACTIONS ---
function chargerJeu(difficulty) {
    currentDifficulty = difficulty;
    
    document.querySelectorAll('.difficulty-selector button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${difficulty}`).classList.add('active');

    let d = new Date();
    seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    if(difficulty === 'facile') seed += 1;
    else if(difficulty === 'difficile') seed += 2;

    fullBoard = generateFullBoard();
    puzzleBoard = createPuzzle(fullBoard, difficulty);
    
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

    const savedSeed = seed;

    // Génération de 8 grilles au lieu de 9
    for (let i = 0; i < 8; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        const formattedDate = currentDate.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        seed = currentDate.getFullYear() * 10000 + (currentDate.getMonth() + 1) * 100 + currentDate.getDate();
        if (difficulty === 'facile') seed += 1;
        else if (difficulty === 'difficile') seed += 2;

        const full = generateFullBoard();
        const puzzleData = createPuzzle(full, difficulty).flat();

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

        seed = savedSeed;
    }
});