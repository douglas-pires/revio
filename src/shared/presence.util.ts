/** Type guard for `.filter(isPresent)`: drops null and undefined, and narrows the element type. */
export const isPresent = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined
