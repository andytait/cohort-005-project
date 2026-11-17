export const MIN_EDITOR_HEIGHT = 240;
export const MAX_EDITOR_HEIGHT = 640;

/**
 * Grow with the content so a short lesson is not a tall empty box, but stop
 * at a cap so a long lesson scrolls inside the editor, not the whole page.
 */
export function editorHeightFor(contentHeight: number): number {
  return Math.min(
    MAX_EDITOR_HEIGHT,
    Math.max(MIN_EDITOR_HEIGHT, Math.ceil(contentHeight))
  );
}
