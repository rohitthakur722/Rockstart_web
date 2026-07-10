import { useContext } from "react";
import { DeviceLibraryContext } from "../context/DeviceLibraryContext";

export function useDeviceLibrary() {
  const context = useContext(DeviceLibraryContext);
  if (!context) {
    throw new Error("useDeviceLibrary must be used within a DeviceLibraryProvider.");
  }
  return context;
}
