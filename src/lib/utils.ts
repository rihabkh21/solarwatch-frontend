import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Utilitaire de fusion de classes CSS Tailwind
// clsx combine les classes conditionnelles, twMerge resout les conflits Tailwind (ex: p-2 vs p-4)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}