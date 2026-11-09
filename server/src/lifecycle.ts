import type { Server } from "node:http";

/**
 * Stop accepting connections, let in-flight requests finish, then resolve. After `timeoutMs` any
 * remaining connections are closed forcibly so the process can exit.
 */
export function gracefulShutdown(httpServer: Server, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      httpServer.closeAllConnections();
      resolve();
    }, timeoutMs);
    timer.unref();
    // Keep-alive connections become idle only once their response is sent, so sweep until closed.
    const sweep = setInterval(() => httpServer.closeIdleConnections(), 50);
    sweep.unref();
    httpServer.close(() => {
      clearTimeout(timer);
      clearInterval(sweep);
      resolve();
    });
    httpServer.closeIdleConnections();
  });
}
