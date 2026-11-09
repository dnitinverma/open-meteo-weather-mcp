import type { App } from "@modelcontextprotocol/ext-apps";
import { createContext, useContext } from "react";

/** The connected App (null in the preview page and in tests without a host). */
export const AppContext = createContext<App | null>(null);
export const useAppInstance = () => useContext(AppContext);
