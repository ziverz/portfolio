const puzzle = document.getElementById('portrait-puzzle');
const puzzleTitle = document.getElementById('puzzle-title');
const puzzleStatus = document.getElementById('puzzle-status');

function createRandomOrder() {
    let shuffled;

    do {
        shuffled = [0, 1, 2, 3, 4, 5];
        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
        }
    } while (shuffled.filter((piece, position) => piece !== position).length < 4);

    return shuffled;
}

let order = createRandomOrder();
let selectedPosition = null;
let draggedPosition = null;

function piecePosition(piece) {
    const column = piece % 2;
    const row = Math.floor(piece / 2);
    return `${column * 100}% ${row * 50}%`;
}

function isSolved() {
    return order.every((piece, position) => piece === position);
}

function renderPuzzle() {
    const solved = isSolved();

    puzzle.innerHTML = order.map((piece, position) => `
        <button class="puzzle-piece${selectedPosition === position ? ' is-selected' : ''}"
            type="button"
            draggable="${!solved}"
            data-position="${position}"
            style="background-position: ${piecePosition(piece)}"
            aria-label="Puzzle piece in position ${position + 1}${selectedPosition === position ? ', selected' : ''}">
        </button>
    `).join('');

    puzzle.classList.toggle('is-solved', solved);
    puzzleTitle.textContent = solved ? 'You solved it! 🎉' : 'Solve the puzzle!';
    puzzleStatus.textContent = solved ? "Nice work — that's me!" : '';
}

function swapPieces(first, second) {
    if (first === second) {
        selectedPosition = null;
        renderPuzzle();
        return;
    }

    [order[first], order[second]] = [order[second], order[first]];
    selectedPosition = null;
    renderPuzzle();
}

puzzle.addEventListener('click', (event) => {
    const piece = event.target.closest('.puzzle-piece');
    if (!piece || isSolved()) return;

    const position = Number(piece.dataset.position);
    if (selectedPosition === null) {
        selectedPosition = position;
        puzzleStatus.textContent = 'Now choose where this piece should go.';
        renderPuzzle();
        puzzleStatus.textContent = 'Now choose where this piece should go.';
    } else {
        swapPieces(selectedPosition, position);
    }
});

puzzle.addEventListener('dragstart', (event) => {
    const piece = event.target.closest('.puzzle-piece');
    if (!piece || isSolved()) return;

    draggedPosition = Number(piece.dataset.position);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(draggedPosition));
});

puzzle.addEventListener('dragover', (event) => {
    if (event.target.closest('.puzzle-piece') && !isSolved()) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }
});

puzzle.addEventListener('drop', (event) => {
    const piece = event.target.closest('.puzzle-piece');
    if (!piece || draggedPosition === null || isSolved()) return;

    event.preventDefault();
    swapPieces(draggedPosition, Number(piece.dataset.position));
    draggedPosition = null;
});

puzzle.addEventListener('dragend', () => {
    draggedPosition = null;
});

renderPuzzle();
