import type { Route } from "./+types/puzzle";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { LEVELS, type LevelId } from "../puzzle-config";

// Calculate day of year (1-365/366) based on user's local timezone
function getDayOfYear(): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  // Clamp to 1-365 (for leap years, day 366 uses puzzle 365)
  return Math.min(Math.max(dayOfYear, 1), 365);
}

// Get formatted local date string
function getLocalDateString(): string {
  const now = new Date();
  return now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Daily Puzzle - 5 Difficulty Levels | NYK Labs" },
    { name: "description", content: "Play our daily jigsaw puzzle with 5 difficulty levels. Easier levels (1-3) feature drag-and-drop only, while advanced levels (4-5) add rotation for an engaging daily brain challenge." },
  ];
}

interface PuzzlePiece {
  id: number;
  correctX: number;
  correctY: number;
  currentX: number;
  currentY: number;
  rotation: number; // 0, 90, 180, 270
  isPlaced: boolean;
  imageOffsetX: number;
  imageOffsetY: number;
}

interface PuzzleData {
  imageSrc: string;
  pieces: number;
  gridCols: number;
  gridRows: number;
}

export default function Puzzle() {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedLevel, setSelectedLevel] = useState<LevelId>("level-1");
  const [gameStarted, setGameStarted] = useState(false);
  const [puzzleData, setPuzzleData] = useState<PuzzleData | null>(null);
  const [pieces, setPieces] = useState<PuzzlePiece[]>([]);
  const [draggingPiece, setDraggingPiece] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [completed, setCompleted] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const assemblyAreaRef = useRef<HTMLDivElement>(null);
  const piecesBankRef = useRef<HTMLDivElement>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef(false);

  // Mobile detection and tap-to-place state
  const [isMobile, setIsMobile] = useState(false);
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(null);
  const [wrongCell, setWrongCell] = useState<{ col: number; row: number } | null>(null);

  // Reset to landing page when navigating to this route
  useEffect(() => {
    setGameStarted(false);
    setPuzzleData(null);
    setPieces([]);
    setCompleted(false);
    setSelectedPieceId(null);
    setWrongCell(null);
  }, [location.key]);

  // Calculate puzzle number based on user's local date
  const todaysPuzzleNumber = useMemo(() => getDayOfYear(), []);
  const localDateString = useMemo(() => getLocalDateString(), []);

  const level = LEVELS.find((l) => l.id === selectedLevel)!;

  // Detect mobile/touch devices
  useEffect(() => {
    const checkMobile = () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isTouchDevice && isSmallScreen);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Calculate responsive sizes - fit within viewport on mobile
  const getPuzzleDimensions = useCallback(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 768;
    const isMobileDevice = isTouchDevice && isSmallScreen;

    const aspectRatio = level.gridCols / level.gridRows;

    if (isMobileDevice) {
      // On mobile, calculate based on available viewport height
      // Layout: header(60) + padding(8) + assembly + gap(12) + reference(50) + gap(12) + bank + padding(16)
      // Bank height ≈ assembly height (same grid structure)
      // So: availableHeight = 2 * puzzleHeight + fixedElements
      const headerHeight = 60;
      const referenceRowHeight = 50;
      const gaps = 24; // gaps between elements
      const padding = 24; // top + bottom padding
      const bankLabelHeight = 40; // label text in pieces bank
      const fixedHeight = headerHeight + referenceRowHeight + gaps + padding + bankLabelHeight;

      // Available height for assembly + bank (both are roughly same height)
      const availableForPuzzles = window.innerHeight - fixedHeight;
      const maxPuzzleHeight = availableForPuzzles / 2;

      // Calculate width from height constraint
      const heightConstrainedWidth = maxPuzzleHeight * aspectRatio;

      // Also constrain by screen width
      const maxWidth = window.innerWidth - 16;

      // Use the smaller of the two constraints
      const width = Math.min(heightConstrainedWidth, maxWidth);
      const height = width / aspectRatio;

      return { width, height };
    } else {
      // On desktop, limit to 360px width
      const maxWidth = Math.min(window.innerWidth - 32, 360);
      const width = maxWidth;
      const height = width / aspectRatio;
      return { width, height };
    }
  }, [level.gridCols, level.gridRows]);

  const [puzzleDimensions, setPuzzleDimensions] = useState({ width: 300, height: 200 });

  useEffect(() => {
    const updateDimensions = () => {
      setPuzzleDimensions(getPuzzleDimensions());
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [getPuzzleDimensions]);

  const pieceWidth = puzzleDimensions.width / level.gridCols;
  const pieceHeight = puzzleDimensions.height / level.gridRows;

  const initializePuzzle = useCallback(async () => {
    // Load puzzle data from JSON file based on day of year
    const puzzlePath = `/puzzles/${selectedLevel}/puzzle-${todaysPuzzleNumber}.json`;

    try {
      const response = await fetch(puzzlePath);
      if (!response.ok) {
        // Use fallback data for demo
        const fallbackData: PuzzleData = {
          imageSrc: "/puzzles/sample-puzzle.jpg",
          pieces: level.pieces,
          gridCols: level.gridCols,
          gridRows: level.gridRows,
        };
        setPuzzleData(fallbackData);
        return fallbackData;
      }
      const data = await response.json();
      setPuzzleData(data);
      return data;
    } catch {
      // Use fallback
      const fallbackData: PuzzleData = {
        imageSrc: "/puzzles/sample-puzzle.jpg",
        pieces: level.pieces,
        gridCols: level.gridCols,
        gridRows: level.gridRows,
      };
      setPuzzleData(fallbackData);
      return fallbackData;
    }
  }, [selectedLevel, level, todaysPuzzleNumber]);

  const createPieces = useCallback(() => {
    const newPieces: PuzzlePiece[] = [];
    const { gridCols, gridRows } = level;

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const id = row * gridCols + col;
        newPieces.push({
          id,
          correctX: col * pieceWidth,
          correctY: row * pieceHeight,
          currentX: 0,
          currentY: 0,
          rotation: level.allowRotation ? Math.floor(Math.random() * 4) * 90 : 0,
          isPlaced: false,
          imageOffsetX: col * pieceWidth,
          imageOffsetY: row * pieceHeight,
        });
      }
    }

    // Shuffle pieces in the bank
    const shuffled = [...newPieces].sort(() => Math.random() - 0.5);
    setPieces(shuffled);
  }, [level, pieceWidth, pieceHeight]);

  const handlePlay = async () => {
    setCompleted(false);
    setImageLoaded(false);
    await initializePuzzle();
    setGameStarted(true);
  };

  // Track if pieces have been initialized to prevent reset on resize
  const piecesInitializedRef = useRef(false);

  useEffect(() => {
    if (gameStarted && puzzleData && imageLoaded && !piecesInitializedRef.current) {
      createPieces();
      piecesInitializedRef.current = true;
    }
  }, [gameStarted, puzzleData, imageLoaded, createPieces]);

  // Reset the initialization flag when game is reset or level changes
  useEffect(() => {
    if (!gameStarted) {
      piecesInitializedRef.current = false;
    }
  }, [gameStarted]);

  // Re-initialize puzzle when level changes during active game (for "Next Level" button)
  useEffect(() => {
    if (gameStarted && !puzzleData && !completed) {
      initializePuzzle();
    }
  }, [gameStarted, puzzleData, completed, initializePuzzle]);

  // Update piece positions when dimensions change (preserving isPlaced state)
  useEffect(() => {
    if (piecesInitializedRef.current && pieces.length > 0) {
      setPieces(prevPieces => prevPieces.map(piece => {
        const col = piece.id % level.gridCols;
        const row = Math.floor(piece.id / level.gridCols);
        const newCorrectX = col * pieceWidth;
        const newCorrectY = row * pieceHeight;
        return {
          ...piece,
          correctX: newCorrectX,
          correctY: newCorrectY,
          currentX: piece.isPlaced ? newCorrectX : piece.currentX,
          currentY: piece.isPlaced ? newCorrectY : piece.currentY,
          imageOffsetX: col * pieceWidth,
          imageOffsetY: row * pieceHeight,
        };
      }));
    }
  }, [pieceWidth, pieceHeight, level.gridCols]);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, pieceId: number) => {
    e.preventDefault();
    const piece = pieces.find((p) => p.id === pieceId);
    if (!piece || piece.isPlaced) return;

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    // Track start position for tap detection
    dragStartPosRef.current = { x: clientX, y: clientY };
    hasMovedRef.current = false;

    const pieceElement = document.getElementById(`piece-${pieceId}`);
    if (pieceElement) {
      const rect = pieceElement.getBoundingClientRect();
      setDragOffset({
        x: clientX - rect.left,
        y: clientY - rect.top,
      });
    }

    setDraggingPiece(pieceId);
  };

  const handleDragMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (draggingPiece === null) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      // Check if we've moved enough to consider it a drag (not a tap)
      if (dragStartPosRef.current) {
        const dx = Math.abs(clientX - dragStartPosRef.current.x);
        const dy = Math.abs(clientY - dragStartPosRef.current.y);
        if (dx > 5 || dy > 5) {
          hasMovedRef.current = true;
        }
      }

      // Only move piece if we've actually started dragging
      if (!hasMovedRef.current) return;

      const assemblyArea = assemblyAreaRef.current;
      if (!assemblyArea) return;

      const rect = assemblyArea.getBoundingClientRect();

      setPieces((prev) =>
        prev.map((p) =>
          p.id === draggingPiece
            ? {
                ...p,
                currentX: clientX - rect.left - dragOffset.x,
                currentY: clientY - rect.top - dragOffset.y,
              }
            : p
        )
      );
    },
    [draggingPiece, dragOffset]
  );

  const handleDragEnd = useCallback(() => {
    if (draggingPiece === null) return;

    const piece = pieces.find((p) => p.id === draggingPiece);
    if (!piece) {
      setDraggingPiece(null);
      dragStartPosRef.current = null;
      return;
    }

    // If no significant movement and rotation is allowed, treat as tap and rotate
    if (!hasMovedRef.current && level.allowRotation) {
      setPieces((prev) =>
        prev.map((p) =>
          p.id === draggingPiece ? { ...p, rotation: (p.rotation + 90) % 360 } : p
        )
      );
      setDraggingPiece(null);
      dragStartPosRef.current = null;
      return;
    }

    // Check if piece is close to correct position (and rotation is correct if rotation is enabled)
    const tolerance = Math.min(pieceWidth, pieceHeight) * 0.3;
    const positionCorrect =
      Math.abs(piece.currentX - piece.correctX) < tolerance &&
      Math.abs(piece.currentY - piece.correctY) < tolerance;
    const rotationCorrect = !level.allowRotation || piece.rotation === 0;
    const isCloseToCorrect = positionCorrect && rotationCorrect;

    if (isCloseToCorrect) {
      setPieces((prev) => {
        const updated = prev.map((p) =>
          p.id === draggingPiece
            ? { ...p, currentX: p.correctX, currentY: p.correctY, isPlaced: true }
            : p
        );

        // Check if all pieces are placed
        const allPlaced = updated.every((p) => p.isPlaced);
        if (allPlaced) {
          setCompleted(true);
        }

        return updated;
      });
    }

    setDraggingPiece(null);
    dragStartPosRef.current = null;
  }, [draggingPiece, pieces, pieceWidth, pieceHeight]);

  useEffect(() => {
    if (draggingPiece !== null) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      window.addEventListener("touchmove", handleDragMove);
      window.addEventListener("touchend", handleDragEnd);

      return () => {
        window.removeEventListener("mousemove", handleDragMove);
        window.removeEventListener("mouseup", handleDragEnd);
        window.removeEventListener("touchmove", handleDragMove);
        window.removeEventListener("touchend", handleDragEnd);
      };
    }
  }, [draggingPiece, handleDragMove, handleDragEnd]);

  // Mobile tap-to-place: select a piece from the bank
  const handlePieceSelect = (pieceId: number) => {
    const piece = pieces.find((p) => p.id === pieceId);
    if (!piece || piece.isPlaced) return;

    if (selectedPieceId === pieceId) {
      // Tapping same piece: if rotation allowed, rotate it
      if (level.allowRotation) {
        setPieces((prev) =>
          prev.map((p) =>
            p.id === pieceId ? { ...p, rotation: (p.rotation + 90) % 360 } : p
          )
        );
      } else {
        // Deselect if no rotation
        setSelectedPieceId(null);
      }
    } else {
      // Select this piece
      setSelectedPieceId(pieceId);
    }
  };

  // Mobile tap-to-place: tap on grid cell to place selected piece
  const handleCellTap = (col: number, row: number) => {
    if (selectedPieceId === null) return;

    const piece = pieces.find((p) => p.id === selectedPieceId);
    if (!piece || piece.isPlaced) {
      setSelectedPieceId(null);
      return;
    }

    // Calculate which row/col this piece belongs in
    const pieceCorrectCol = Math.round(piece.correctX / pieceWidth);
    const pieceCorrectRow = Math.round(piece.correctY / pieceHeight);

    // Check if tapped cell matches the piece's correct position
    const positionCorrect = col === pieceCorrectCol && row === pieceCorrectRow;
    const rotationCorrect = !level.allowRotation || piece.rotation === 0;
    const isCorrect = positionCorrect && rotationCorrect;

    if (isCorrect) {
      // Snap to correct position
      setPieces((prev) => {
        const updated = prev.map((p) =>
          p.id === selectedPieceId
            ? { ...p, currentX: p.correctX, currentY: p.correctY, isPlaced: true }
            : p
        );

        // Check if all pieces are placed
        const allPlaced = updated.every((p) => p.isPlaced);
        if (allPlaced) {
          setCompleted(true);
        }

        return updated;
      });
      setSelectedPieceId(null);
    } else {
      // Wrong position - show visual feedback via shake animation
      setWrongCell({ col, row });
      setTimeout(() => setWrongCell(null), 300);
    }
  };

  const handleReset = () => {
    setCompleted(false);
    setSelectedPieceId(null);
    setWrongCell(null);
    createPieces();
  };

  const handleBack = () => {
    setGameStarted(false);
    setPuzzleData(null);
    setPieces([]);
    setCompleted(false);
    setSelectedPieceId(null);
    setWrongCell(null);
  };

  const handleNextLevel = () => {
    const currentLevelIndex = LEVELS.findIndex((l) => l.id === selectedLevel);
    if (currentLevelIndex < LEVELS.length - 1) {
      // Go to next level - reset state and change level
      // The useEffect watching selectedLevel will re-initialize the puzzle
      const nextLevel = LEVELS[currentLevelIndex + 1].id;
      piecesInitializedRef.current = false;
      setCompleted(false);
      setPuzzleData(null);
      setPieces([]);
      setSelectedPieceId(null);
      setWrongCell(null);
      setImageLoaded(false);
      setSelectedLevel(nextLevel);
    } else {
      // At level 5, go to main page
      navigate("/");
    }
  };

  if (!gameStarted) {
    return (
      <main>
        <section className="card puzzle-selection">
          <div className="date-info">
            <p className="current-date">{localDateString}</p>
            <p className="puzzle-number">Puzzle #{todaysPuzzleNumber} of 365</p>
          </div>

          <div className="form-group">
            <label htmlFor="difficulty-level">Difficulty Level</label>
            <select
              id="difficulty-level"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value as LevelId)}
            >
              {LEVELS.map((lvl) => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.label} ({lvl.pieces} pieces)
                </option>
              ))}
            </select>
          </div>

          <button type="submit" onClick={handlePlay}>
            Play
          </button>
        </section>

        <style>{`
          .puzzle-selection {
            max-width: 400px;
          }

          .date-info {
            background: rgba(34, 211, 238, 0.1);
            border: 1px solid rgba(34, 211, 238, 0.3);
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            text-align: center;
          }

          .current-date {
            color: var(--accent);
            font-weight: 600;
            margin-bottom: 0.25rem;
          }

          .puzzle-number {
            color: var(--muted);
            font-size: 0.9rem;
          }

          .puzzle-selection .form-group {
            margin: 1.5rem 0;
          }

          .puzzle-selection select {
            font-size: 1.1rem;
            padding: 1rem;
          }

          .puzzle-selection button {
            margin-top: 1rem;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="puzzle-main">
      <div className="puzzle-container">

        {completed && (
          <div className="celebration-overlay">
            {/* Fireworks */}
            <div className="fireworks">
              <div className="firework"></div>
              <div className="firework"></div>
              <div className="firework"></div>
              <div className="firework"></div>
              <div className="firework"></div>
            </div>
            {/* Confetti */}
            <div className="confetti-container">
              {Array.from({ length: 50 }).map((_, i) => (
                <div
                  key={i}
                  className="confetti"
                  style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 3}s`,
                    backgroundColor: ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590', '#277da1', '#9b5de5', '#f15bb5'][i % 10],
                  }}
                />
              ))}
            </div>
            <div className="completion-message">
              <div className="celebration-emoji">🎉🎊🎆</div>
              <h3>Congratulations!</h3>
              <p>You completed the puzzle!</p>
              <div className="celebration-emoji">🏆⭐🌟</div>
              <button
                type="button"
                onClick={handleNextLevel}
                className="next-level-btn"
              >
                {selectedLevel === "level-5" ? "Back to Home" : "Next Level"}
              </button>
            </div>
          </div>
        )}

        {/* Hidden image for preloading */}
        {puzzleData && (
          <img
            src={puzzleData.imageSrc}
            alt="puzzle"
            onLoad={handleImageLoad}
            style={{ display: "none" }}
          />
        )}

        {!imageLoaded && puzzleData && (
          <div className="loading">Loading puzzle...</div>
        )}

        {imageLoaded && puzzleData && (
          <>
            {/* Puzzle info header */}
            <div className="puzzle-header">
              <h2>Puzzle #{todaysPuzzleNumber}</h2>
              <span className="puzzle-subtitle">{level.label}</span>
            </div>

            {/* Assembly Area */}
            <div
              ref={assemblyAreaRef}
              className="assembly-area"
              style={{
                width: puzzleDimensions.width,
                height: puzzleDimensions.height,
              }}
            >
              {/* Background cue image */}
              <div
                className="assembly-background"
                style={{
                  backgroundImage: `url(${puzzleData.imageSrc})`,
                  backgroundSize: `${puzzleDimensions.width}px ${puzzleDimensions.height}px`,
                }}
              />
              {/* Grid overlay */}
              <div className="grid-overlay">
                {Array.from({ length: level.gridRows }).map((_, row) =>
                  Array.from({ length: level.gridCols }).map((_, col) => {
                    // Check if this cell already has a placed piece
                    const cellOccupied = pieces.some(
                      (p) =>
                        p.isPlaced &&
                        Math.abs(p.correctX - col * pieceWidth) < 1 &&
                        Math.abs(p.correctY - row * pieceHeight) < 1
                    );
                    const isWrongCell = wrongCell?.col === col && wrongCell?.row === row;
                    return (
                      <div
                        key={`grid-${row}-${col}`}
                        className={`grid-cell ${isMobile && selectedPieceId !== null && !cellOccupied ? "tappable" : ""} ${isWrongCell ? "wrong-placement" : ""}`}
                        style={{
                          width: pieceWidth,
                          height: pieceHeight,
                          left: col * pieceWidth,
                          top: row * pieceHeight,
                        }}
                        onClick={
                          isMobile && selectedPieceId !== null && !cellOccupied
                            ? () => handleCellTap(col, row)
                            : undefined
                        }
                      />
                    );
                  })
                )}
              </div>

              {/* Placed pieces */}
              {pieces
                .filter((p) => p.isPlaced)
                .map((piece) => (
                  <div
                    key={`placed-${piece.id}`}
                    className="puzzle-piece placed"
                    style={{
                      width: pieceWidth,
                      height: pieceHeight,
                      left: piece.correctX,
                      top: piece.correctY,
                      backgroundImage: `url(${puzzleData.imageSrc})`,
                      backgroundPosition: `-${piece.imageOffsetX}px -${piece.imageOffsetY}px`,
                      backgroundSize: `${puzzleDimensions.width}px ${puzzleDimensions.height}px`,
                    }}
                  />
                ))}

              {/* Dragging piece in assembly area */}
              {pieces
                .filter((p) => !p.isPlaced && draggingPiece === p.id)
                .map((piece) => (
                  <div
                    key={`dragging-${piece.id}`}
                    id={`piece-${piece.id}`}
                    className="puzzle-piece dragging"
                    style={{
                      width: pieceWidth,
                      height: pieceHeight,
                      left: piece.currentX,
                      top: piece.currentY,
                      transform: `rotate(${piece.rotation}deg)`,
                      backgroundImage: `url(${puzzleData.imageSrc})`,
                      backgroundPosition: `-${piece.imageOffsetX}px -${piece.imageOffsetY}px`,
                      backgroundSize: `${puzzleDimensions.width}px ${puzzleDimensions.height}px`,
                    }}
                  />
                ))}
            </div>

            {/* Pieces Bank */}
            <div ref={piecesBankRef} className={`pieces-bank ${isMobile ? "mobile" : ""}`}>
              {!completed && (
                <p className="bank-label">
                  {isMobile
                    ? level.allowRotation
                      ? "Tap a piece to select (tap again to rotate), tap a cell to place."
                      : "Tap a piece to select, then tap a cell to place."
                    : level.allowRotation
                      ? "Tap to rotate. Drag and drop to place in the puzzle."
                      : "Drag and drop pieces to place them in the puzzle."}
                </p>
              )}
              <div
                className="pieces-grid"
                style={{
                  gridTemplateColumns: `repeat(${level.gridCols}, ${pieceWidth}px)`,
                }}
              >
                {pieces
                  .filter((p) => !p.isPlaced && draggingPiece !== p.id)
                  .map((piece) => (
                    <div
                      key={piece.id}
                      className="piece-cell"
                      style={{
                        width: pieceWidth,
                        height: pieceHeight,
                      }}
                    >
                      <div
                        id={`piece-${piece.id}`}
                        className={`puzzle-piece in-bank ${selectedPieceId === piece.id ? "selected" : ""}`}
                        style={{
                          width: pieceWidth,
                          height: pieceHeight,
                          transform: `rotate(${piece.rotation}deg)`,
                          backgroundImage: `url(${puzzleData.imageSrc})`,
                          backgroundPosition: `-${piece.imageOffsetX}px -${piece.imageOffsetY}px`,
                          backgroundSize: `${puzzleDimensions.width}px ${puzzleDimensions.height}px`,
                        }}
                        onMouseDown={isMobile ? undefined : (e) => handleDragStart(e, piece.id)}
                        onTouchStart={isMobile ? undefined : (e) => handleDragStart(e, piece.id)}
                        onClick={isMobile ? () => handlePieceSelect(piece.id) : undefined}
                      />
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        .puzzle-main {
          flex-direction: column;
          padding: 1rem;
          align-items: center;
        }

        .puzzle-container {
          width: 100%;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }


        .puzzle-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
        }

        .puzzle-header h2 {
          font-size: 1rem;
          color: var(--accent);
          margin: 0;
        }

        .puzzle-subtitle {
          font-size: 0.85rem;
          color: var(--muted);
        }

        .assembly-background {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-repeat: no-repeat;
          background-position: center;
          opacity: 0.25;
          pointer-events: none;
        }

        .celebration-overlay {
          position: relative;
          overflow: hidden;
          border-radius: 12px;
          padding: 1.5rem;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(139, 92, 246, 0.3));
          border: 2px solid #10b981;
          animation: celebrationPulse 1s ease-in-out infinite alternate;
        }

        @keyframes celebrationPulse {
          from { box-shadow: 0 0 20px rgba(16, 185, 129, 0.5), 0 0 40px rgba(139, 92, 246, 0.3); }
          to { box-shadow: 0 0 30px rgba(16, 185, 129, 0.8), 0 0 60px rgba(139, 92, 246, 0.5); }
        }

        .completion-message {
          text-align: center;
          color: #fff;
          position: relative;
          z-index: 10;
        }

        .completion-message h3 {
          font-size: 1.5rem;
          margin: 0.5rem 0;
          color: #10b981;
          text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
          animation: bounceIn 0.6s ease-out;
        }

        .completion-message p {
          font-size: 1.1rem;
          margin: 0.5rem 0;
          color: #e5e7eb;
        }

        .celebration-emoji {
          font-size: 2rem;
          animation: bounce 0.5s ease infinite alternate;
        }

        .next-level-btn {
          margin-top: 1rem;
          padding: 0.75rem 2rem;
          font-size: 1rem;
          font-weight: 600;
          color: #0f172a;
          background: linear-gradient(135deg, #10b981, #34d399);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }

        .next-level-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
        }

        .next-level-btn:active {
          transform: translateY(0);
        }

        @keyframes bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-10px); }
        }

        @keyframes bounceIn {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }

        /* Fireworks */
        .fireworks {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .firework {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          animation: fireworkExplode 1.5s ease-out infinite;
        }

        .firework:nth-child(1) { left: 10%; top: 20%; animation-delay: 0s; }
        .firework:nth-child(2) { left: 85%; top: 15%; animation-delay: 0.3s; }
        .firework:nth-child(3) { left: 50%; top: 10%; animation-delay: 0.6s; }
        .firework:nth-child(4) { left: 25%; top: 30%; animation-delay: 0.9s; }
        .firework:nth-child(5) { left: 75%; top: 25%; animation-delay: 1.2s; }

        @keyframes fireworkExplode {
          0% {
            transform: scale(1);
            opacity: 1;
            box-shadow:
              0 0 0 0 #f94144,
              0 0 0 0 #f3722c,
              0 0 0 0 #f9c74f,
              0 0 0 0 #90be6d,
              0 0 0 0 #577590,
              0 0 0 0 #9b5de5,
              0 0 0 0 #f15bb5,
              0 0 0 0 #00bbf9;
          }
          50% {
            transform: scale(1);
            opacity: 1;
            box-shadow:
              -20px -20px 0 2px #f94144,
              20px -20px 0 2px #f3722c,
              20px 20px 0 2px #f9c74f,
              -20px 20px 0 2px #90be6d,
              0 -30px 0 2px #577590,
              0 30px 0 2px #9b5de5,
              -30px 0 0 2px #f15bb5,
              30px 0 0 2px #00bbf9;
          }
          100% {
            transform: scale(1);
            opacity: 0;
            box-shadow:
              -40px -40px 0 0 #f94144,
              40px -40px 0 0 #f3722c,
              40px 40px 0 0 #f9c74f,
              -40px 40px 0 0 #90be6d,
              0 -50px 0 0 #577590,
              0 50px 0 0 #9b5de5,
              -50px 0 0 0 #f15bb5,
              50px 0 0 0 #00bbf9;
          }
        }

        /* Confetti */
        .confetti-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .confetti {
          position: absolute;
          width: 10px;
          height: 10px;
          top: -10px;
          opacity: 0.8;
          animation: confettiFall 3s ease-in-out infinite;
        }

        .confetti:nth-child(odd) {
          border-radius: 50%;
        }

        .confetti:nth-child(even) {
          border-radius: 2px;
          transform: rotate(45deg);
        }

        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(150px) rotate(720deg);
            opacity: 0;
          }
        }

        .loading {
          text-align: center;
          padding: 2rem;
          color: var(--muted);
        }

        .assembly-area {
          position: relative;
          background: rgba(255, 255, 255, 0.05);
          border: 2px dashed rgba(34, 211, 238, 0.5);
          border-radius: 8px;
          margin: 0 auto;
          overflow: hidden;
        }

        .grid-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
        }

        .grid-cell {
          position: absolute;
          border: 1px dashed rgba(255, 255, 255, 0.1);
          box-sizing: border-box;
        }

        .puzzle-piece {
          position: absolute;
          background-repeat: no-repeat;
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-sizing: border-box;
          cursor: grab;
          transition: box-shadow 0.2s;
        }

        .puzzle-piece.placed {
          cursor: default;
          border-color: transparent;
        }

        .puzzle-piece.dragging {
          cursor: grabbing;
          z-index: 100;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }

        .puzzle-piece.in-bank {
          position: relative;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .puzzle-piece.in-bank:hover {
          box-shadow: 0 4px 16px rgba(34, 211, 238, 0.3);
        }

        .pieces-bank {
          background: var(--card);
          border: 1px solid #1f2937;
          border-radius: 8px;
          padding: 1rem;
        }

        .bank-label {
          font-size: 0.875rem;
          color: var(--muted);
          margin-bottom: 1rem;
          text-align: center;
        }

        .pieces-grid {
          display: grid;
          gap: 4px;
          justify-content: center;
        }

        .piece-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: visible;
        }

        @media (max-width: 400px) {
          .puzzle-header h2 {
            font-size: 0.85rem;
          }
        }

        /* Mobile-specific styles for tap-to-place and full-screen layout */
        @media (max-width: 768px) {
          .puzzle-main {
            padding: 0;
            padding-top: 0.5rem;
            padding-bottom: 0.5rem;
            height: calc(100vh - 60px);
            max-height: calc(100vh - 60px);
            overflow: hidden;
            justify-content: flex-start;
          }

          .puzzle-container {
            max-width: 100%;
            width: 100%;
            padding: 0 0.5rem;
            gap: 0.5rem;
            height: 100%;
            overflow: hidden;
          }

          .assembly-area {
            border-radius: 4px;
            flex-shrink: 0;
          }

          .pieces-bank.mobile {
            padding: 0.5rem;
            border-radius: 4px;
            flex: 1;
            overflow-y: auto;
            min-height: 0;
          }

          .grid-cell.tappable {
            pointer-events: auto;
            cursor: pointer;
            background: rgba(34, 211, 238, 0.15);
            border: 1px dashed rgba(34, 211, 238, 0.5) !important;
            transition: background 0.2s;
          }

          .grid-cell.tappable:active {
            background: rgba(34, 211, 238, 0.3);
          }

          .puzzle-piece.in-bank.selected {
            box-shadow: 0 0 0 3px var(--accent), 0 4px 16px rgba(34, 211, 238, 0.5);
            z-index: 10;
          }

          .puzzle-header {
            flex-shrink: 0;
            gap: 0.5rem;
          }

          .puzzle-header h2 {
            font-size: 0.85rem;
          }

          .bank-label {
            font-size: 0.75rem;
            margin-bottom: 0.5rem;
          }
        }

        /* Selected piece animation */
        .puzzle-piece.in-bank.selected {
          animation: selectedPulse 1s ease-in-out infinite alternate;
        }

        @keyframes selectedPulse {
          from {
            box-shadow: 0 0 0 3px var(--accent), 0 4px 16px rgba(34, 211, 238, 0.4);
          }
          to {
            box-shadow: 0 0 0 4px var(--accent), 0 6px 24px rgba(34, 211, 238, 0.6);
          }
        }

        /* Wrong placement feedback */
        .grid-cell.wrong-placement {
          animation: wrongShake 0.3s ease;
          background: rgba(239, 68, 68, 0.3) !important;
        }

        @keyframes wrongShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
      `}</style>
    </main>
  );
}
