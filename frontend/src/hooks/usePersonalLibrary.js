import { useContext } from "react";
import { PersonalLibraryContext } from "../context/PersonalLibraryContext";

export function usePersonalLibrary() {
  const context = useContext(PersonalLibraryContext);
  if (!context) {
    throw new Error("usePersonalLibrary must be used within a PersonalLibraryProvider.");
  }
  return context;
}
