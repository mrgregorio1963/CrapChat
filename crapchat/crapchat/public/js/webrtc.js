/**
 * Mesh WebRTC for small groups (up to MAX peers) using Socket.IO signaling.
 */

const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class CallSession {
  /**
   * @param {object} opts
   * @param {import('socket.io-client').Socket} opts.socket
   * @param {string} opts.roomId
   * @param {string} opts.name
   * @param {MediaStream} opts.localStream  video(canvas)+audio
   * @param {(peerId:string, stream:MediaStream, name:string) => void} opts.onPeerStream
   * @param {(peerId:string) => void} opts.onPeerLeft
   * @param {(peerId:string, name:string) => void} opts.onPeerJoined
   * @param {(emoji:string, from:string) => void} opts.onReaction
   * @param {(on:boolean, from:string) => void} opts.onHold
   * @param {(err:string) => void} opts.onError
   */
  constructor(opts) {
    this.socket = opts.socket;
    this.roomId = opts.roomId;
    this.name = opts.name;
    this.localStream = opts.localStream;
    this.onPeerStream = opts.onPeerStream;
    this.onPeerLeft = opts.onPeerLeft;
    this.onPeerJoined = opts.onPeerJoined;
    this.onReaction = opts.onReaction;
    this.onHold = opts.onHold;
    this.onError = opts.onError;
    /** @type {Map<string, RTCPeerConnection>} */
    this.pcs = new Map();
    /** @type {Map<string, string>} */
    this.names = new Map();
    this.peerId = null;
    this._bound = false;
  }

  async join() {
    this._bindSocket();
    return new Promise((resolve, reject) => {
      this.socket.emit(
        'join',
        { roomId: this.roomId, name: this.name },
        async (res) => {
          if (!res || res.error) {
            reject(new Error(res?.error || 'Join failed'));
            return;
          }
          this.peerId = res.peerId;
          for (const p of res.peers || []) {
            this.names.set(p.peerId, p.name);
            this.onPeerJoined?.(p.peerId, p.name);
            await this._createOffer(p.peerId);
          }
          resolve(res);
        }
      );
    });
  }

  _bindSocket() {
    if (this._bound) return;
    this._bound = true;

    this.socket.on('peer-joined', async ({ peerId, name }) => {
      this.names.set(peerId, name);
      this.onPeerJoined?.(peerId, name);
      // Existing peers wait for offer from the new joiner (who creates offers to others)
    });

    this.socket.on('peer-left', ({ peerId }) => {
      this._closePc(peerId);
      this.names.delete(peerId);
      this.onPeerLeft?.(peerId);
    });

    this.socket.on('signal', async ({ from, data }) => {
      try {
        await this._handleSignal(from, data);
      } catch (e) {
        console.warn('signal error', e);
        this.onError?.(e.message);
      }
    });

    this.socket.on('reaction', ({ from, emoji }) => {
      this.onReaction?.(emoji, from);
    });

    this.socket.on('hold', ({ from, on }) => {
      this.onHold?.(!!on, from);
    });
  }

  async _ensurePc(peerId) {
    if (this.pcs.has(peerId)) return this.pcs.get(peerId);
    const pc = new RTCPeerConnection(ICE);
    this.pcs.set(peerId, pc);

    for (const track of this.localStream.getTracks()) {
      pc.addTrack(track, this.localStream);
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.socket.emit('signal', {
          to: peerId,
          data: { type: 'ice', candidate: ev.candidate },
        });
      }
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] || new MediaStream([ev.track]);
      this.onPeerStream?.(peerId, stream, this.names.get(peerId) || 'Peer');
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        // soft: don't immediately remove on disconnected
        if (pc.connectionState === 'failed') {
          this._closePc(peerId);
          this.onPeerLeft?.(peerId);
        }
      }
    };

    return pc;
  }

  async _createOffer(peerId) {
    const pc = await this._ensurePc(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.socket.emit('signal', {
      to: peerId,
      data: { type: 'offer', sdp: pc.localDescription },
    });
  }

  async _handleSignal(from, data) {
    const pc = await this._ensurePc(from);
    if (data.type === 'offer') {
      await pc.setRemoteDescription(data.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket.emit('signal', {
        to: from,
        data: { type: 'answer', sdp: pc.localDescription },
      });
    } else if (data.type === 'answer') {
      await pc.setRemoteDescription(data.sdp);
    } else if (data.type === 'ice' && data.candidate) {
      try {
        await pc.addIceCandidate(data.candidate);
      } catch (_) {}
    }
  }

  /** Replace outbound tracks (e.g. new audio after silencer toggle, or canvas video) */
  async replaceTrack(kind, track) {
    for (const pc of this.pcs.values()) {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === kind);
      if (sender) await sender.replaceTrack(track);
    }
    const old = this.localStream.getTracks().find((t) => t.kind === kind);
    if (old) {
      this.localStream.removeTrack(old);
      // don't stop old video canvas track if same; caller manages
    }
    if (track) this.localStream.addTrack(track);
  }

  sendReaction(emoji) {
    this.socket.emit('reaction', { emoji });
  }

  sendHold(on) {
    this.socket.emit('hold', { on: !!on });
  }

  _closePc(peerId) {
    const pc = this.pcs.get(peerId);
    if (pc) {
      try { pc.close(); } catch (_) {}
      this.pcs.delete(peerId);
    }
  }

  leave() {
    this.socket.emit('leave');
    for (const id of [...this.pcs.keys()]) this._closePc(id);
    this.socket.off('peer-joined');
    this.socket.off('peer-left');
    this.socket.off('signal');
    this.socket.off('reaction');
    this.socket.off('hold');
    this._bound = false;
  }
}
