const THEMES = ['theme1', 'theme2'];

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

// --- DÉMARRAGE ---
initialiserPartie();
chargerJeu('moyen');