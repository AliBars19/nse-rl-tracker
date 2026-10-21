/** Public ballchasing pages for a replay we uploaded. Work for unlisted and public replays, not private ones. */

/** The replay's stats page. */
export const replayPage = (id: string) => `https://ballchasing.com/replay/${encodeURIComponent(id)}`;

/** The same page opened on its "3D Replay viewer" tab (ballchasing's own menu link is `#watch`). */
export const replayViewer = (id: string) => `${replayPage(id)}#watch`;
