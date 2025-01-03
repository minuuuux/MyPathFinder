const GRID_SIZE = 10;
let currentMode = 'wall';
let grid = [];
let startPos = null;
let endPos = null;
let isDragging = false;
let draggedElement = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let selectedCell = null;
let connections = new Set(); // 연결 정보 저장
let selectedForConnection = null; // 선 연결을 위해 선택된 아이템
let lastAddedItem = null; // 마지막으로 추가된 그리드 아이템 추적

// 상태 히스토리 관리를 위한 변수들 추가
let stateHistory = [];
let currentStateIndex = -1;
const MAX_HISTORY = 10; // 최대 히스토리 저장 개수

let isGroupSelecting = false;
let selectedGroupItems = new Set();
let selectionRect = null;
let startX = 0;
let startY = 0;

//배경 이미지
let img = document.createElement('img');
img.src = './map2.png'; // 이미지 경로 설정
// 이미지 스타일 설정 (선택 사항)
img.alt = 'Map Image';
img.style.width = '100%'; // 필요에 따라 크기 조정
img.style.height = '100%'; 

img.onload = function(){
    console.log("width : " , img.width);
    console.log("width : " , img.height);
    const gridContainer = document.querySelector("#gridContainer");
    const pathLayer = document.querySelector("#pathLayer");
    const connectionLayer = document.querySelector("#connectionLayer");
    gridContainer.style.width  = img.width;
    gridContainer.style.height = img.height;
    pathLayer.style.width  = img.width;
    pathLayer.style.height = img.height;
    connectionLayer.style.width  = img.width;
    connectionLayer.style.height = img.height;
}


// 현재 상태를 저장하는 함수
function saveState() {
    const state = {
        gridItems: Array.from(document.getElementsByClassName('grid-item')).map(item => ({
            id: item.getAttribute('data-id'),
            left: item.style.left,
            top: item.style.top,
            classes: Array.from(item.classList),
        })),
        connections: Array.from(connections),
        startPosId: startPos ? startPos.getAttribute('data-id') : null,
        endPosId: endPos ? endPos.getAttribute('data-id') : null
    };

    // 현재 상태 이후의 히스토리 제거
    stateHistory = stateHistory.slice(0, currentStateIndex + 1);
    
    // 새로운 상태 추가
    stateHistory.push(JSON.stringify(state));
    currentStateIndex++;

    // 최대 히스토리 개수 유지
    if (stateHistory.length > MAX_HISTORY) {
        stateHistory.shift();
        currentStateIndex--;
    }
}

// 상태 복원 함수
function restoreState(state) {
    const gridContainer = document.getElementById('grid');
    gridContainer.innerHTML = '';
    gridContainer.appendChild(img);
    connections.clear();
    startPos = null;
    endPos = null;

    // 그리드 아이템 복원
    state.gridItems.forEach(item => {
        const cell = document.createElement('div');
        cell.className = 'grid-item';
        cell.setAttribute('data-id', item.id);
        cell.style.left = item.left;
        cell.style.top = item.top;
        
        // 클래스 복원
        item.classes.forEach(className => {
            if (className !== 'grid-item') {
                cell.classList.add(className);
            }
        });

        // 시작점과 끝점 복원
        if (item.id === state.startPosId) startPos = cell;
        if (item.id === state.endPosId) endPos = cell;

        // 이벤트 리스너 다 추가
        cell.addEventListener('mousedown', dragStart);
        cell.addEventListener('touchstart', dragStart, { passive: false });
        cell.addEventListener('click', () => handleCellClick(cell));

        gridContainer.appendChild(cell);
    });

    // 연결 복원
    state.connections.forEach(connection => connections.add(connection));
    updateConnections();
}

// Ctrl+Z 이벤트 처리
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'z') {
        if (currentStateIndex > 0) {
            currentStateIndex--;
            const previousState = JSON.parse(stateHistory[currentStateIndex]);
            restoreState(previousState);
        }
    }
});

// 그리드 초기화
function initializeGrid() {
    const gridContainer = document.getElementById('grid');
    grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

    // 그리드 컨테이너 클릭 이벤트 수정
    gridContainer.addEventListener('click', function(e) {
        if (currentMode === 'add' || currentMode === 'single-add') {  // single-add 모드 추가
            const rect = gridContainer.getBoundingClientRect();
            const gridItemSize = 12; // width(10px) + border(2px)
            const x = e.clientX - rect.left - (gridItemSize / 200);
            const y = e.clientY - rect.top - (gridItemSize / 200);
            addGridItem(x, y);
        }
    });

    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);
}

// 그리드 아이템 추가 함수 수정
function addGridItem(x = 0, y = 0) {
    console.log("그리드 추가 x좌표: ", x );
    console.log("그리드 추가 y좌표: ", y );
    const gridContainer = document.getElementById('grid');
    const cell = document.createElement('div');
    cell.className = 'grid-item';
    cell.setAttribute('data-id', Date.now().toString());
    
    // 쉬프트 키가 눌려 있고 이전 그리드가 있는 경우, 그리고 현재 모드가 'single-add'가 아닌 경우에만
    if (event.shiftKey && lastAddedItem && currentMode !== 'single-add') {
        const lastRect = lastAddedItem.getBoundingClientRect();
        const containerRect = gridContainer.getBoundingClientRect();
        
        const mouseX = event.clientX - containerRect.left;
        const mouseY = event.clientY - containerRect.top;
        
        const deltaX = Math.abs(mouseX - (lastRect.left - containerRect.left));
        const deltaY = Math.abs(mouseY - (lastRect.top - containerRect.top));
        
        if (deltaX > deltaY) {
            y = lastRect.top - containerRect.top;
        } else {
            x = lastRect.left - containerRect.left;
        }
    }

    cell.style.left = `${x}px`;
    cell.style.top = `${y}px`;

    cell.addEventListener('mousedown', dragStart);
    cell.addEventListener('touchstart', dragStart, { passive: false });
    cell.addEventListener('click', () => handleCellClick(cell));

    gridContainer.appendChild(cell);

    // 'single-add' 모드가 아닐 때만 이전 아이템과 연결
    if (currentMode !== 'single-add' && lastAddedItem) {
        const connection = createConnectionKey(lastAddedItem, cell);
        connections.add(connection);
        console.log("connection : ", connection);
    }

    lastAddedItem = cell;
    updateConnections();
    saveState();
}

function dragStart(e) {
    if (currentMode === 'drag') {
        e.preventDefault();
        isDragging = true;
        draggedElement = e.target;
        draggedElement.classList.add('dragging');

        const rect = draggedElement.getBoundingClientRect();
        if (e.type === 'mousedown') {
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
        } else {
            dragOffsetX = e.touches[0].clientX - rect.left;
            dragOffsetY = e.touches[0].clientY - rect.top;
        }
    }
}

function drag(e) {
    if (isDragging && draggedElement) {
        e.preventDefault();
        
        const container = document.getElementById('grid');
        const rect = container.getBoundingClientRect();
        
        let clientX, clientY;
        if (e.type === 'mousemove') {
            clientX = e.clientX;
            clientY = e.clientY;
        } else {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }

        let newX = clientX - rect.left - dragOffsetX;
        let newY = clientY - rect.top - dragOffsetY;

        // 그리드 내 경계 설정
        newX = Math.max(0, Math.min(newX, rect.width - draggedElement.offsetWidth));
        newY = Math.max(0, Math.min(newY, rect.height - draggedElement.offsetHeight));

        draggedElement.style.left = newX + 'px';
        draggedElement.style.top = newY + 'px';

        // 연결선 업데이트
        updateConnections();
    }
}

function dragEnd() {
    if (isDragging && draggedElement) {
        draggedElement.classList.remove('dragging');
        draggedElement = null;
        isDragging = false;

        // 연결선 업데이트
        updateConnections();
        saveState(); // 상태 저장 추가

        // 경로가 있다면 다시 그리기
        const pathLayer = document.getElementById('pathLayer');
        if (pathLayer.innerHTML !== '') {
            findPath();
        }
    }
}

// 셀 클릭 처리
function handleCellClick(cell) {
    console.log("셀클릭 : ", cell)
    if (isDragging) return;

    if (currentMode === 'delete') {
        // 시작점이나 도착점인 경우 해당 참조 제거
        if (cell === startPos) startPos = null;
        if (cell === endPos) endPos = null;
        
        // 연결된 모든 선 제거
        const cellId = cell.getAttribute('data-id');
        connections.forEach(connection => {
            if (connection.includes(cellId)) {
                connections.delete(connection);
            }
        });
        
        // 그리드 아이템 제거
        cell.remove();
        updateConnections();
        saveState();
        return;
    }

    if (currentMode === 'connect') {
        handleConnectionClick(cell);
    } else if (currentMode === 'start') {
        if (startPos) {
            startPos.classList.remove('start');
        }
        cell.classList.add('start');
        startPos = cell;
    } else if (currentMode === 'end') {
        if (endPos) {
            endPos.classList.remove('end');
        }
        cell.classList.add('end');
        endPos = cell;
    } else if (currentMode === 'wall') {
        cell.classList.toggle('wall');
    }
    saveState(); // 상태 저장 추가
}

// 연결 클릭 처리
function handleConnectionClick(cell) {
    console.log("연결 클릭 : ", cell)
    if (!selectedForConnection) {
        // 첫 번째 아이템 선택
        selectedForConnection = cell;
        cell.classList.add('selected-for-connection');
    } else if (selectedForConnection === cell) {
        // 같은 아이템 다시 클릭
        selectedForConnection.classList.remove('selected-for-connection');
        selectedForConnection = null;
    } else {
        // 두 번째 아이템 선택 - 연결 토글
        const connection = createConnectionKey(selectedForConnection, cell);
        if (connections.has(connection)) {
            connections.delete(connection);
        } else {
            connections.add(connection);
        }
        
        // 선택 상태 초기화
        selectedForConnection.classList.remove('selected-for-connection');
        selectedForConnection = null;
        
        // 연결선 업데이트
        updateConnections();
    }
    if (selectedForConnection === null) {
        saveState(); // 상태 저장 추가
    }
}

// 연결 키 생성
function createConnectionKey(cell1, cell2) {
    const id1 = cell1.getAttribute('data-id');
    const id2 = cell2.getAttribute('data-id');
    return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
}

// 모드 설정 함수 수정
function setMode(mode) {
    currentMode = mode;
    selectedForConnection = null;
    lastAddedItem = null; // 모드 변경 시 마지막 아이템 초기화
    
    // 그룹 선택 모드 종료 시 초기화
    if (mode !== 'group-connect') {
        clearGroupSelection();
    }
    
    const gridItems = document.querySelectorAll('.grid-item');
    gridItems.forEach(item => {
        if (mode === 'connect') {
            item.style.cursor = 'crosshair';
        } else if (mode === 'drag') {
            item.style.cursor = 'move';
        } else if (mode === 'add') {
            item.style.cursor = 'pointer';
        } else if (mode === 'group-connect') {
            item.style.cursor = 'crosshair';
        } else {
            item.style.cursor = 'pointer';
        }
        item.classList.remove('selected-for-connection');
    });

    const gridContainer = document.getElementById('grid');
    gridContainer.style.cursor = mode === 'add' ? 'crosshair' : 'default';

    // 그룹 선택 모드일 때 이벤트 리스너 추가
    if (mode === 'group-connect') {
        setupGroupSelection();
    }
}

function setupGroupSelection() {
    const gridContainer = document.getElementById('grid');
    
    gridContainer.addEventListener('mousedown', startGroupSelection);
    gridContainer.addEventListener('mousemove', updateGroupSelection);
    gridContainer.addEventListener('mouseup', endGroupSelection);
    
    // 그리드 아이템 클릭 이벤트 추가
    const gridItems = document.querySelectorAll('.grid-item');
    gridItems.forEach(item => {
        item.addEventListener('click', handleGroupItemClick);
    });
}

function startGroupSelection(e) {
    if (currentMode !== 'group-connect' || e.target.classList.contains('grid-item')) return;
    
    // 새로운 그룹 선택 시작 시 이전 그룹 초기화
    clearGroupSelection();
    
    isGroupSelecting = true;
    const gridContainer = document.getElementById('grid');
    const rect = gridContainer.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;

    // 선택 영역 생성
    selectionRect = document.createElement('div');
    selectionRect.style.position = 'absolute';
    selectionRect.style.border = '2px dashed #ff4081';
    selectionRect.style.backgroundColor = 'rgba(255, 64, 129, 0.1)';
    selectionRect.style.pointerEvents = 'none';
    selectionRect.style.left = startX + 'px';
    selectionRect.style.top = startY + 'px';
    gridContainer.appendChild(selectionRect);
}

function updateGroupSelection(e) {
    console.log("updateGroupSelection : ", e)
    if (!isGroupSelecting || !selectionRect) return;

    const gridContainer = document.getElementById('grid');
    const rect = gridContainer.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selectionRect.style.left = left + 'px';
    selectionRect.style.top = top + 'px';
    selectionRect.style.width = width + 'px';
    selectionRect.style.height = height + 'px';

    // 선택 영역 내의 그리드 아이템 확인
    const gridItems = document.querySelectorAll('.grid-item');
    gridItems.forEach(item => {
        const itemRect = item.getBoundingClientRect();
        const itemLeft = itemRect.left - rect.left;
        const itemTop = itemRect.top - rect.top;

        if (itemLeft >= left && itemLeft <= left + width &&
            itemTop >= top && itemTop <= top + height) {
            item.classList.add('selected-group');
            selectedGroupItems.add(item);
        }
    });
}

function endGroupSelection(e) {
    if (!isGroupSelecting) return;
    
    isGroupSelecting = false;
    if (selectionRect) {
        selectionRect.remove();
        selectionRect = null;
    }
}

function handleGroupItemClick(e) {
    if (currentMode !== 'group-connect') return;
    
    const clickedItem = e.target;
    
    // 이미 선택된 그룹에 속한 아이템을 클릭한 경우
    if (clickedItem.classList.contains('selected-group')) {
        clickedItem.classList.remove('selected-group');
        selectedGroupItems.delete(clickedItem);
        return;
    }

    // 선택된 그룹이 있고, 선택되지 않은 아이템을 클릭한 경우
    if (selectedGroupItems.size > 0) {
        // 선택된 모든 그룹 아이템과 연결
        selectedGroupItems.forEach(groupItem => {
            const connection = createConnectionKey(groupItem, clickedItem);
            connections.add(connection);
        });
        
        // 선택 초기화
        clearGroupSelection();
        updateConnections();
        saveState();
    }
}

function clearGroupSelection() {
    // 모든 그리드 아이템에서 선택 클래스 제거
    const gridItems = document.querySelectorAll('.grid-item');
    gridItems.forEach(item => {
        item.classList.remove('selected-group');
    });
    selectedGroupItems.clear();
    
    // 선택 영역 제거
    if (selectionRect) {
        selectionRect.remove();
        selectionRect = null;
    }
}

// 그리드 초기화
function resetGrid() {
    const gridContainer = document.getElementById('grid');
    gridContainer.innerHTML = '';
    gridContainer.appendChild(img);
    startPos = null;
    endPos = null;
    connections.clear();
    selectedForConnection = null;
    updateConnections();
}

// 그리드 상태 저장 함수
function saveGridState() {
    const state = {
        gridItems: Array.from(document.getElementsByClassName('grid-item')).map(item => ({
            id: item.getAttribute('data-id'),
            left: item.style.left,
            top: item.style.top,
            classes: Array.from(item.classList)
        })),
        connections: Array.from(connections),
        startPosId: startPos ? startPos.getAttribute('data-id') : null,
        endPosId: endPos ? endPos.getAttribute('data-id') : null
    };

    try {
        localStorage.setItem('gridState', JSON.stringify(state));
        alert('그리드 상태가 저장되었습니다.');
    } catch (e) {
        alert('저장 중 오류가 발생했습니다.');
        console.error('저장 오류:', e);
    }
}

// 저장된 상태 불러오기 함수
function loadSavedState() {
    const savedState = localStorage.getItem('gridState');
    if (savedState) {
        try {
            const state = JSON.parse(savedState);
            restoreState(state);
        } catch (e) {
            console.error('상태 복원 오류:', e);
        }
    }
}

// 페이지 로드 시 저장된 상태 불러오기
window.onload = function() {
    initializeGrid();
    loadSavedState();
    saveState();
};

// 두 점 사이의 거리 계산 함수 추가
function calculateDistance(element1, element2) {
    const rect1 = element1.getBoundingClientRect();
    const rect2 = element2.getBoundingClientRect();
    const dx = (rect1.left + rect1.width/2) - (rect2.left + rect2.width/2);
    const dy = (rect1.top + rect1.height/2) - (rect2.top + rect2.height/2);
    return Math.sqrt(dx * dx + dy * dy);
}

// 경로 찾기 함수 수정
function findPath() {
    if (!startPos || !endPos) {
        alert('시작점과 도착점을 모두 설정해주세요.');
        return;
    }

    clearPath();

    const nodes = new Map();
    const gridItems = document.getElementsByClassName('grid-item');
    Array.from(gridItems).forEach(item => {
        nodes.set(item.getAttribute('data-id'), item);
    });

    const startId = startPos.getAttribute('data-id');
    const endId = endPos.getAttribute('data-id');

    // 거리와 경로를 함께 저장
    const distances = new Map();
    const previous = new Map();
    const unvisited = new Set();

    // 초기화
    nodes.forEach((_, id) => {
        distances.set(id, Infinity);
        unvisited.add(id);
    });
    distances.set(startId, 0);

    while (unvisited.size > 0) {
        // 가장 가까운 노드 찾기
        let currentId = null;
        let shortestDistance = Infinity;
        unvisited.forEach(id => {
            if (distances.get(id) < shortestDistance) {
                shortestDistance = distances.get(id);
                currentId = id;
            }
        });

        if (currentId === null || currentId === endId) break;

        unvisited.delete(currentId);

        // 연결된 노드들 확인
        for (const connection of connections) {
            const [id1, id2] = connection.split('-');
            let nextId = null;

            if (id1 === currentId) nextId = id2;
            else if (id2 === currentId) nextId = id1;
            else continue;

            if (!unvisited.has(nextId)) continue;

            // 실제 물리적 거리 계산
            const distance = calculateDistance(nodes.get(currentId), nodes.get(nextId));
            const totalDistance = distances.get(currentId) + distance;

            if (totalDistance < distances.get(nextId)) {
                distances.set(nextId, totalDistance);
                previous.set(nextId, currentId);
            }
        }
    }

    // 경로 재구성
    if (!previous.has(endId)) {
        alert('경로를 찾을 수 없습니다.');
        return;
    }

    const path = [];
    let currentId = endId;
    while (currentId !== undefined) {
        path.unshift(currentId);
        currentId = previous.get(currentId);
    }

    drawPathFromIds(path);
}

// ID 배열부터 경로 그리기
function drawPathFromIds(pathIds) {
    const pathLayer = document.getElementById('pathLayer');
    pathLayer.innerHTML = '';

    const gridContainer = document.querySelector('.grid-container');
    const containerRect = gridContainer.getBoundingClientRect();

    // SVG 크기만 설정
    // pathLayer.setAttribute('width', containerRect.width);
    // pathLayer.setAttribute('height', containerRect.height);

    const pathCoordinates = pathIds.map(id => {
        const element = document.querySelector(`[data-id="${id}"]`);
        const rect = element.getBoundingClientRect();
        const itemWidth = 12;
        const itemHeight = 12;
        return {
            x: rect.left + (itemWidth / 2) + window.scrollX,
            y: rect.top + (itemHeight / 2) + window.scrollY 
        };
    });

    // SVG 경로 데이터 생성
    const pathData = pathCoordinates.reduce((acc, coord, i) => {
        return acc + (i === 0 ? `M${coord.x},${coord.y}` : `L${coord.x},${coord.y}`);
    }, '');

    // SVG 경로 요소 생성
    const svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svgPath.setAttribute('id', 'motionPath');
    svgPath.setAttribute('d', pathData);
    svgPath.setAttribute('stroke', '#2196F3');
    svgPath.setAttribute('stroke-width', '3');
    svgPath.setAttribute('fill', 'none');
    //svgPath.style.strokeDasharray = svgPath.getTotalLength();
    //svgPath.style.strokeDashoffset = svgPath.getTotalLength();
    //svgPath.style.animation = 'drawPath 1s ease-out forwards';

    pathLayer.appendChild(svgPath);

    // 아이콘 요소 생성 (circle 대신 image 사용)
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    icon.setAttribute('href', 'data:image/png;base64,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'); // 이미지 경로 설정
    icon.setAttribute('width', '50'); // 이미지 너비
    icon.setAttribute('height', '50'); // 이미지 높이
    // 이미지 중앙 정렬을 위한 오프셋 설정
    icon.setAttribute('x', '-25');
    icon.setAttribute('y', '-25');

    // 애니메이션 요소 추가
    const animateMotion = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
    animateMotion.setAttribute('dur', '3s'); // 이미지가 경로를 따라 움직이는 시간
    animateMotion.setAttribute('repeatCount', '1');
    animateMotion.setAttribute('path', pathData);
    animateMotion.setAttribute('fill', 'remove'); // 애니메이션 끝나면 초기 상태로
    animateMotion.setAttribute('begin', 'indefinite'); // 명시적으로 시작
    animateMotion.setAttribute('calcMode', 'linear'); // 애니메이션이 일정한 속도로 진행되도록 설정

    // 애니메이션 종료 후 아이콘 제거
    animateMotion.addEventListener('endEvent', () => {
        icon.remove();
        clearPath();//경로제거
    });

    icon.appendChild(animateMotion);
    pathLayer.appendChild(icon);

    // 애니메이션 시작
    animateMotion.beginElement();
}

// 경로 제거
function clearPath() {
    const pathLayer = document.getElementById('pathLayer');
    pathLayer.innerHTML = '';
}

// 연결선 업데이트
function updateConnections() {
    const connectionLayer = document.getElementById('connectionLayer');
    connectionLayer.innerHTML = '';

    const gridContainer = document.querySelector('.grid-container');
    const containerRect = gridContainer.getBoundingClientRect();

    // SVG 레이어 위치 및 크기 조정
    // connectionLayer.style.left = containerRect.left + 'px';
    // connectionLayer.style.top = containerRect.top + 'px';
    // connectionLayer.style.width = containerRect.width + 'px';
    // connectionLayer.style.height = containerRect.height + 'px';

    // 저장된 연결 정보를 바탕으로 선 그리기
    connections.forEach(connection => {
        const [id1, id2] = connection.split('-');
        const item1 = document.querySelector(`[data-id="${id1}"]`);
        const item2 = document.querySelector(`[data-id="${id2}"]`);

        if (item1 && item2) {
            const rect1 = item1.getBoundingClientRect();
            const rect2 = item2.getBoundingClientRect();

            // const x1 = rect1.left - containerRect.left + (rect1.width / 2);
            // const y1 = rect1.top - containerRect.top + (rect1.height / 2) ;
            // const x2 = rect2.left - containerRect.left + (rect2.width / 2);
            // const y2 = rect2.top - containerRect.top + (rect2.height / 2) ;
            const x1 = rect1.left  + (rect1.width / 2) + window.scrollX;
            const y1 = rect1.top  + (rect1.height / 2) + window.scrollY;
            const x2 = rect2.left  + (rect2.width / 2) + window.scrollX;
            const y2 = rect2.top + (rect2.height / 2)  + window.scrollY;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.classList.add('connection-line');

            connectionLayer.appendChild(line);
        }
    });
}

// window resize 이벤트 핸들러 추가
window.addEventListener('resize', () => {
    updateConnections();
});

// 저장된 그리드 상태 불러오기 함수
function loadGridState() {
    const savedState = localStorage.getItem('gridState');
    if (savedState) {
        try {
            const state = JSON.parse(savedState);
            // 현재 그리드 초기화
            resetGrid();
            // 저장된 상태 복원
            restoreState(state);
            alert('저장된 그리드를 불러왔습니다.');
        } catch (e) {
            alert('그리드 불러오기 중 오류가 발생했습니다.');
            console.error('불러오기 오류:', e);
        }
    } else {
        alert('저장된 그리드가 없습니다.');
    }
}

// 그룹 선 해제 함수
function removeGroupConnections() {
    if (selectedGroupItems.size < 2) {
        alert('2개 이상의 그리드를 선택해주세요.');
        return;
    }

    // 선택된 그룹의 모든 아이템 ID 배열
    const selectedIds = Array.from(selectedGroupItems).map(item => item.getAttribute('data-id'));

    // 선택된 그룹 간의 모든 연결 제거
    connections.forEach(connection => {
        const [id1, id2] = connection.split('-');
        if (selectedIds.includes(id1) && selectedIds.includes(id2)) {
            connections.delete(connection);
        }
    });

    // 연결선 업데이트
    updateConnections();
    
    // 그룹 선택 초기화
    clearGroupSelection();
    
    // 상태 저장
    saveState();
}