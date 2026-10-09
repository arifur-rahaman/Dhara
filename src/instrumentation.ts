/**
 * Runs once when a Next.js server starts. With RUN_JOBS=1 this process also runs the background
 * worker (reminders); set it on exactly the instances that should do so.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.RUN_JOBS !== '1') return;
  const { startWorker } = await import('@/server/jobs/worker');
  await startWorker();
}
