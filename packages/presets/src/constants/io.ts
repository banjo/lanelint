/** Node builtins that do I/O: files, processes, the network, and the terminal. */
export const IO_BUILTINS =
  'node:{fs,fs/promises,child_process,http,https,http2,net,dgram,dns,dns/promises,cluster,worker_threads,readline,readline/promises}';

/** Globals that do I/O or read the environment. */
export const IO_GLOBALS = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'process',
  'localStorage',
  'sessionStorage',
  'document',
  'window',
];
