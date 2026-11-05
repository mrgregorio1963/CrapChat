/** PG-13 toilet-humor copy for CrapChat */

export const SPLASH_MESSAGES = [
  'Warming the seat…',
  'Unrolling the welcome mat…',
  'Checking porcelain levels…',
  'Negotiating with gravity…',
  'Buffering dignity…',
  'Finding your happy place…',
  'Polishing the throne…',
];

export const TOASTS = {
  silencerOn: [
    'Fart Silencer ON. Your secret is safe with DSP.',
    'Noise gate armed. Let it rip (quietly).',
    'Acoustic stealth mode engaged. 🥷💨',
    'Silence is golden. And so is this filter.',
  ],
  silencerOff: [
    'Fart Silencer OFF. Living dangerously.',
    'Raw audio. Bold choice.',
    'Natural acoustics restored. Bold.',
  ],
  flush: [
    'FLUSHED! Instant office mode. You look very employable.',
    'Emergency Flush! Background: Business. Mic: nope.',
    'Whoosh! Back to looking like a Serious Professional™.',
  ],
  joined: [
    'You\'re on the throne. Own it.',
    'Session started. Sit tall.',
    'Welcome to the call. Nobody needs to know.',
  ],
  peerJoined: [
    'Another sitter entered the stall.',
    'Company! Best behavior.',
    'Peer connected. Smile like you have lumbar support.',
  ],
  peerLeft: [
    'They flushed and left.',
    'Peer departed. More elbow room.',
  ],
  hangup: [
    'Session flushed. See you next sit.',
    'Call ended. Hands washed? Good.',
  ],
  customBg: [
    'Custom backdrop locked in. Fancy.',
    'Your upload is ready. Very mysterious of you.',
  ],
  copy: ['Invite link copied. Share wisely.', 'Link in clipboard. Don\'t drop it.'],
};

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
