import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { annotationGlyph, annotationLabel } from "./glyphs";
import type { MoveAnnotation } from "./types";

type SquareProps = {
  children?: ReactNode;
  square: string;
  squareColor: "white" | "black";
  style?: CSSProperties;
  annotation?: MoveAnnotation | null;
};

export const AnnotatedSquare = forwardRef<HTMLDivElement, SquareProps>(
  function AnnotatedSquare(
    { children, square, squareColor, style, annotation },
    ref,
  ) {
    return (
      <div
        ref={ref}
        data-square={square}
        data-square-color={squareColor}
        style={{ ...style, position: "relative" }}
      >
        {children}
        {annotation ? (
          <span
            className={`move-glyph glyph-${annotation.kind}`}
            title={annotationLabel(annotation)}
          >
            {annotationGlyph(annotation)}
          </span>
        ) : null}
      </div>
    );
  },
);
