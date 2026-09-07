import { ControlEvent, TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';

const args = process.argv.slice(2);
const username = args.find((arg) => !arg.startsWith('--'));
const getNumber = (name, fallback) => {
  const value = args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
};
const seconds = Math.max(1, getNumber('seconds', 180));
const disconnectAfter = Math.max(0, getNumber('disconnect-after', 60));
const reconnectDelay = Math.max(5, getNumber('reconnect-delay', 10));
const debug = args.includes('--debug');

if (!username) {
  console.error('Usage: npm run start -- @username [--seconds=180] [--disconnect-after=60]');
  process.exitCode = 2;
} else {
  const channel = username.replace(/^@/, '').trim();
  const connection = new TikTokLiveConnection(channel, {
    fetchRoomInfoOnConnect: true,
    webClientOptions: { timeout: { request: 10000 } },
    wsClientOptions: { handshakeTimeout: 10000 }
  });
  const startedAt = Date.now();
  const counts = { comments: 0, likes: 0, gifts: 0, roomUsers: 0 };
  const firstSeen = new Set();
  let latestViewers;
  let latestRoomInfo;
  let firstRoomId;
  let reconnectCount = 0;
  let controlledDisconnect = false;
  let reconnectTimer;
  let finishTimer;
  let disconnectTimer;
  let shutdownStarted = false;

  const timestamp = () => new Date().toISOString();
  const value = (item) => item ?? 'not observed';
  const sample = (name) => {
    if (firstSeen.has(name)) return false;
    firstSeen.add(name);
    return true;
  };
  const log = (event, fields = {}) => {
    const suffix = Object.entries(fields).map(([key, item]) => `${key}=${value(item)}`).join(' ');
    console.log(`[${event}] ${suffix}`.trim());
  };
  const inspect = (label, data) => {
    if (!debug || firstSeen.has(`debug:${label}`)) return;
    firstSeen.add(`debug:${label}`);
    log(`DEBUG_${label}`, { keys: Object.keys(data ?? {}).join(',') || 'none', prototype: Object.getOwnPropertyNames(Object.getPrototypeOf(data ?? {})).join(',') || 'none' });
  };
  const printSummary = () => {
    log('SUMMARY', {
      observedSeconds: Math.round((Date.now() - startedAt) / 1000),
      roomId: firstRoomId,
      title: latestRoomInfo?.title ?? latestRoomInfo?.room?.title,
      latestViewerCount: latestViewers,
      roomUserEvents: counts.roomUsers,
      commentEvents: counts.comments,
      likeEvents: counts.likes,
      giftEvents: counts.gifts,
      reconnects: reconnectCount
    });
  };
  const shutdown = async (reason, print = true) => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    clearTimeout(finishTimer);
    clearTimeout(disconnectTimer);
    clearTimeout(reconnectTimer);
    if (print) {
      log('SHUTDOWN', { reason });
      printSummary();
    }
    await connection.disconnect().catch(() => {});
    connection.removeAllListeners();
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
  };
  const finish = async () => {
    await shutdown('observation-window');
  };

  const onSigint = () => { void shutdown('SIGINT'); };
  const onSigterm = () => { void shutdown('SIGTERM'); };
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);

  connection.on(ControlEvent.ERROR, ({ info, exception }) => {
    log('ERROR', { info: info ?? exception?.message ?? 'unknown' });
  });
  connection.on(ControlEvent.CONNECTED, (state) => {
    latestRoomInfo = state.roomInfo;
    firstRoomId ??= state.roomId;
    log('CONNECTED', { roomId: state.roomId, localTimestamp: timestamp() });
    if (sample('title')) log('ROOM_INFO', { keys: Object.keys(state.roomInfo ?? {}).join(',') || 'none', title: state.roomInfo?.title ?? state.roomInfo?.room?.title, localTimestamp: timestamp() });
    if (disconnectAfter > 0 && reconnectCount === 0 && !controlledDisconnect && !shutdownStarted) {
      disconnectTimer = setTimeout(() => {
        controlledDisconnect = true;
        log('CONTROLLED_DISCONNECT', { localTimestamp: timestamp() });
        connection.disconnect().catch((error) => log('DISCONNECT_ERROR', { message: error?.message }));
      }, disconnectAfter * 1000);
    }
  });
  connection.on(ControlEvent.DISCONNECTED, ({ code, reason }) => {
    log('DISCONNECTED', { code, reason, localTimestamp: timestamp() });
    if (controlledDisconnect && reconnectCount === 0 && !shutdownStarted) {
      reconnectCount = 1;
      reconnectTimer = setTimeout(() => {
        log('RECONNECT', { attempt: 1, delaySeconds: reconnectDelay });
        if (!shutdownStarted) connection.connect().catch((error) => log('RECONNECT_FAILED', { name: error?.name, message: error?.message }));
      }, reconnectDelay * 1000);
    }
  });
  connection.on(WebcastEvent.ROOM_USER, (data) => {
    inspect('ROOM_USER_KEYS', data);
    counts.roomUsers += 1;
    latestViewers = data.total ?? data.totalUser ?? data.viewerCount;
    if (counts.roomUsers <= 3) log('ROOM_USER', { viewerCount: latestViewers, totalUser: data.totalUser, eventFrequency: counts.roomUsers, providerTimestamp: data.common?.createTime, localTimestamp: timestamp() });
  });
  connection.on(WebcastEvent.CHAT, (data) => {
    inspect('CHAT_KEYS', data);
    counts.comments += 1;
    if (counts.comments <= 3) log('CHAT', { user: '<redacted>', userField: data.user?.id || data.user?.displayId || data.user?.nickname ? 'available' : 'not observed', comment: data.content ? '<redacted>' : 'not observed', eventFrequency: counts.comments, providerTimestamp: data.common?.createTime, localTimestamp: timestamp() });
  });
  connection.on(WebcastEvent.LIKE, (data) => {
    inspect('LIKE_KEYS', data);
    counts.likes += 1;
    if (counts.likes <= 3) log('LIKE', { user: '<redacted>', userField: data.user?.id || data.user?.displayId || data.user?.nickname ? 'available' : 'not observed', likeCount: data.count, totalLikeCount: data.total, eventFrequency: counts.likes, providerTimestamp: data.common?.createTime, localTimestamp: timestamp() });
  });
  connection.on(WebcastEvent.GIFT, (data) => {
    inspect('GIFT_KEYS', data);
    counts.gifts += 1;
    if (counts.gifts <= 3) log('GIFT', { giftId: data.giftId, giftName: data.gift?.name, repeatCount: data.repeatCount, repeatEnd: data.repeatEnd, user: '<redacted>', userField: data.user?.id || data.user?.displayId || data.user?.nickname ? 'available' : 'not observed', providerTimestamp: data.common?.createTime, localTimestamp: timestamp() });
  });

  finishTimer = setTimeout(finish, seconds * 1000);
  log('START', { channel: `@${channel}`, observationSeconds: seconds, disconnectAfterSeconds: disconnectAfter, reconnectDelaySeconds: reconnectDelay, debug });
  connection.connect().then((state) => {
    latestRoomInfo = state.roomInfo;
    firstRoomId ??= state.roomId;
    log('STATUS', { value: 'LIVE' });
  }).catch((error) => {
    clearTimeout(finishTimer);
    log('STATUS', { value: error?.name === 'UserOfflineError' ? 'OFFLINE' : 'UNKNOWN' });
    log('CONNECT_FAILED', { name: error?.name, message: error?.message });
    process.exitCode = error?.name === 'UserOfflineError' ? 0 : 1;
    void shutdown('connect-failure', false);
  });
}
