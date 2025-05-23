'use client'

import Script from 'next/script'
import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import JsSIP from 'jssip'
import { ringback, ringtone } from './ringtons'

function tryParse(value) {
  try {
    return JSON.parse(value)
  } catch (e) {
    return value
  }
}

function parseFromUrl() {
  if (typeof window !== 'undefined') {
    const urlArgs = window.location.href.split('?')[1] || ''
    const entries = [...new URLSearchParams(urlArgs).entries()].map(
      ([k, v]) => {
        return [k, tryParse(v)]
      }
    )
    return Object.fromEntries(entries)
  } else {
    return {}
  }
}

class SipPhone {
  phone: any
  session: any
  connected: any
  stream: any
  phonebook: Map<any, any>
  loggerPrefix: string
  $refs: any
  config: any
  sessionInterval: any
  remoteParty: any
  audio?: HTMLAudioElement
  constructor() {
    this.phone = null
    this.session = null
    this.connected = null
    this.stream = null
    this.phonebook = new Map()
    this.loggerPrefix = 'SP:'
    this.$refs = {
      localVideo: document.getElementById('localVideo'),
      localAudio: document.getElementById('localAudio'),
      remoteVideo: document.getElementById('remoteVideo'),
      remoteAudio: document.getElementById('remoteAudio'),
      stats: document.getElementById('statsBox'),
      title: document.getElementById('title'),
      ringBackAudio: document.getElementById('ringback'),
      ringToneAudio: document.getElementById('ringtone'),
    }

    this.$refs.localAudio.autoplay = true
    this.$refs.remoteAudio.autoplay = true
    this.$refs.localVideo.muted = true
    this.$refs.localVideo.addEventListener('canplay', (e) => {
      this.$refs.localVideo.play()
    })
    this.$refs.remoteVideo.muted = true
    this.$refs.remoteVideo.addEventListener('canplay', (e) => {
      this.$refs.remoteVideo.play()
    })

    this.config = {
      //   pt('phonebook', 'Phonebook', 'Single SIP Address (phone number) for a single call target or a comma-separated list of \'phoneNumber=name\' for multiple call targets').r(),

      // 'Display a button to send a preset DTMF string while in calls for remote doors, gates, etc...'
      dtmfString: '000',
      // 'Full URL of the WebRTC SIP websocket, e.g. \'wss://siphost:8089/ws\' or relative path, e.g. \'/ws\', for Android & iOS, you need wss (WebSocket secured)'
      // websocketUrl,

      enableVideo: true,
      enableSIPDebug: true,
      enableTones: true,

      // SIP registration can be disabled in case you only want to initiate calls, but not receive calls with the SIP widgets.
      disableRegister: false,

      // username: "123",
      // domain: "test.ru",
      // password: "123",

      ...parseFromUrl(),
    }

    if (!this.config.websocketUrl)
      this.alert('Need to set ?websocketUrl param!')
    if (!this.config.username) this.alert('Need to set ?username param!')
    if (!this.config.domain) this.alert('Need to set ?domain param!')
    if (!this.config.password) this.alert('Need to set ?password param!')

    console.info(this.loggerPrefix + ': SipPhone()', this.config)
  }

  alert(text) {
    this.setMessage(text)
  }

  setMessage(text) {
    this.$refs.title.innerHTML = text
  }

  startForegroundActivity() {
    // Load device specific configuration
    // Init phonebook Map
    // Make sure we have Mic/Camera permissions
    if (!navigator.mediaDevices) {
      this.alert(
        'To use the SIP widget, please make sure that HTTPS is in use and WebRTC is supported by this browser.'
      )
    } else {
      this.sipStart()
    }
  }

  stopForegroundActivity() {
    // Stop MediaDevices access here, otherwise Mic/Camera access will stay active on iOS
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = undefined
    }
    if (this.phone) this.phone.stop()
    if (this.sessionInterval) {
      clearInterval(this.sessionInterval)
      this.sessionInterval = null
    }
  }

  sipStart() {
    if (this.phone) this.phone.stop() // reconnect to reload config

    this.config.enableSIPDebug
      ? JsSIP.debug.enable('JsSIP:*')
      : JsSIP.debug.disable()
    // SIP user agent setup
    const url = new URL(this.config.websocketUrl, window.location.origin)
    if (url.protocol.indexOf('http') === 0) {
      url.protocol = url.protocol.replace('http', 'ws')
    }

    console.info(
      this.loggerPrefix + ': JsSIP.WebSocketInterface() ' + url.toString()
    )
    const socket = new JsSIP.WebSocketInterface(url.toString())

    // var uri = new JsSIP.URI("sip", "alice", this.config.domain, 15554);

    const configuration = {
      sockets: [socket],
      uri: 'sip:' + this.config.username + '@' + this.config.domain,
      // uri: uri.toString(),
      stun_servers: ['stun:stun.l.google.com:19302'],
      contact_uri:
        'sip:' +
        this.config.username +
        '@' +
        this.config.domain +
        '' +
        ';custom=info',
      password: this.config.password,
      // session_timers: false,
      register: this.config.disableRegister !== true,
      // display_name: this.config.username,
      // secure_transport: true,
      // hack_use_via_tcp: true,
      // hack_ip_in_contact: true,
    }
    this.phone = new JsSIP.UA(configuration)

    // Update connected status on connection changes
    this.phone.on('connected', () => {
      this.connected = true
      console.info(this.loggerPrefix + ': Connected to SIP server')
    })
    this.phone.on('disconnected', () => {
      this.connected = false
      console.info(this.loggerPrefix + ': Disconnected from SIP server')
    })

    // Register event for new incoming or outgoing call event
    this.phone.on('newRTCSession', (data) => {
      // https://jssip.net/documentation/3.10.x/api/session/
      this.session = data.session
      this.remoteParty =
        this.phonebook.size > 0
          ? this.phonebook.get(this.session.remote_identity.uri.user)
          : this.session.remote_identity.uri.user

      if (this.session.direction === 'outgoing') {
        this.setMessage('SipTest : outgoing')
        // Handle accepted call
        this.session.on('accepted', () => {
          this.stopTones()
          console.info(this.loggerPrefix + ': Outgoing call in progress')
        })
      } else if (this.session.direction === 'incoming') {
        this.setMessage('SipTest : incoming from ' + this.remoteParty)
        console.info(
          this.loggerPrefix + ': Incoming call from ' + this.remoteParty
        )
        this.playTone('ringToneAudio')
        // Handle accepted call
        this.session.on('accepted', () => {
          console.info(this.loggerPrefix + ': Incoming call in progress')
        })
      }

      // Handle ended call
      this.session.on('ended', (reason) => {
        this.stopMedia()
        console.info(this.loggerPrefix + ': Call ended', reason)
      })
      // Handle failed call
      this.session.on('failed', (event) => {
        this.stopTones()
        this.stopMedia()
        console.info(
          this.loggerPrefix + ': Call failed. Reason: ' + event.cause
        )
        this.setMessage('Call failed: ' + event.cause)
      })

      this.session.on('confirmed', (event) => {
        console.info(this.loggerPrefix + ': Confirmed')
      })
      this.session.on('peerconnection:setremotedescriptionfailed', (error) => {
        console.info(this.loggerPrefix + ': !! peerconnection failed')
        console.info(
          error.errorDetail,
          error.receivedAlert,
          error.sctpCauseCode,
          error.sdpLineNumber,
          error.sentAlert,
          error.constructor?.name,
          error.message,
          error.name
        )
      })
      this.session.on('sdp', (data) => {
        console.info(
          this.loggerPrefix + ': RTCRtpReceiver',
          RTCRtpReceiver.getCapabilities('audio').codecs,
          RTCRtpReceiver.getCapabilities('video').codecs
        )
        const sdp = data.sdp.split(/\r?\n/)
        const videoIndex = sdp.findIndex((x) => x.startsWith('m=video'))
        const newSdp =
          sdp.slice(0, videoIndex).join('\r\n').trim('\r\n') + '\r\n'
        data.sdp = newSdp
        console.info(this.loggerPrefix + ': SDP INITIAL', sdp)
        console.info(this.loggerPrefix + ': SDP FIXED', newSdp.split(/\r?\n/))
      })
      // this.session.on("peerconnection", (event) => {
      //   console.info(this.loggerPrefix + ": peerconnection");
      // });
      // this.session.on("hold", (event) => {
      //   console.info(this.loggerPrefix + ": Call on hold");
      // });
      // this.session.on("unhold", (event) => {
      //   console.info(this.loggerPrefix + ": Call on unhold");
      // });
      // this.session.on("muted", (event) => {
      //   console.info(this.loggerPrefix + ": Call on muted");
      // });
      // this.session.on("unmuted", (event) => {
      //   console.info(this.loggerPrefix + ": Call on unmuted");
      // });
      // this.session.on("reinvite", (event) => {
      //   console.info(this.loggerPrefix + ": Call on reinvite", event);
      // });
      // this.session.on("update", (event) => {
      //   console.info(this.loggerPrefix + ": Call on update", event);
      // });
      // this.session.on("refer", (event) => {
      //   console.info(this.loggerPrefix + ": Call on refer", event);
      // });
      // this.session.on("replaces", (event) => {
      //   console.info(this.loggerPrefix + ": Call on replaces", event);
      // });
    })

    this.phone.start()
  }

  stopMedia() {
    // Stop playing ringback or ring tone
    if (this.config.enableVideo) {
      if (this.$refs.remoteVideo.srcObject)
        this.$refs.remoteVideo.srcObject
          .getTracks()
          .forEach((track) => track.stop())
      this.$refs.remoteVideo.srcObject = null
      this.$refs.localVideo.srcObject = null
      if (this.$refs.remoteAudio.srcObject)
        this.$refs.remoteAudio.srcObject
          .getTracks()
          .forEach((track) => track.stop())
      this.$refs.remoteAudio.srcObject = null
      this.$refs.localAudio.srcObject = null
    } else {
      // Make sure all tracks are stopped
      if (this.$refs.remoteAudio.srcObject)
        this.$refs.remoteAudio.srcObject
          .getTracks()
          .forEach((track) => track.stop())
      this.$refs.remoteAudio.srcObject = null
      this.$refs.localAudio.srcObject = null
    }
    if (this.sessionInterval) {
      clearInterval(this.sessionInterval)
      this.sessionInterval = null
    }
  }

  attachEvents() {
    // RTCPeerConnection
    const pc = this.session.connection
    // Отображаем состояние RTCPeerConnection
    pc.addEventListener('connectionstatechange', (event) => {
      console.log(
        this.loggerPrefix + ': Connection state changed:',
        pc.connectionState
      )
    })
    pc.addEventListener('signalingstatechange', (event) => {
      console.log(
        this.loggerPrefix + ': Signaling state changed:',
        pc.signalingState
      )
    })
    // Слушаем события изменения кандидатов ICE
    pc.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        console.log(this.loggerPrefix + ': New ICE candidate:', event.candidate)
      } else {
        console.log(this.loggerPrefix + ': All ICE candidates have been sent.')
      }
    })
    pc.addEventListener('icecandidateerror', (event) => {
      console.log(this.loggerPrefix + ': ICE error:', event)
    })
    // Слушаем события изменения состояния сбора ICE
    pc.addEventListener('icegatheringstatechange', (event) => {
      console.log(
        this.loggerPrefix + ': ICE gathering state changed:',
        pc.iceGatheringState
      )
    })
    // Слушаем события изменения состояния соединения ICE
    pc.addEventListener('iceconnectionstatechange', (event) => {
      console.log(
        this.loggerPrefix + ': ICE connection state changed:',
        pc.iceConnectionState
      )
    })
    pc.addEventListener('negotiationneeded', (event) => {
      console.log(this.loggerPrefix + ': ICE negotiation ended', event)
    })
    // Слушаем события добавления новых треков
    pc.addEventListener('track', (event) => {
      console.log(
        this.loggerPrefix + ': On Track:',
        event.receiver,
        event.streams,
        event.track,
        event.transceiver
      )
    })

    // Для отображения статистики можно использовать метод getStats
    if (this.sessionInterval) clearInterval(this.sessionInterval) // clean previous
    this.sessionInterval = setInterval(() => {
      pc.getStats(null).then((stats) => {
        let statsOutput = ''

        stats.forEach((report) => {
          statsOutput +=
            `<h2>Report: ${report.type}</h2>\n<strong>ID:</strong> ${report.id}<br>\n` +
            `<strong>Timestamp:</strong> ${report.timestamp}<br>\n`

          // Now the statistics for this report; we intentionally drop the ones we
          // sorted to the top above

          Object.keys(report).forEach((statName) => {
            if (
              statName !== 'id' &&
              statName !== 'timestamp' &&
              statName !== 'type'
            ) {
              statsOutput += `<strong>${statName}:</strong> ${report[statName]}<br>\n`
            }
          })
        })

        this.$refs.stats.innerHTML = statsOutput
      })
    }, 1000)
  }

  async attachLocalStream() {
    if (this.stream) return Promise.resolve(this.stream)
    return navigator.mediaDevices
      .getUserMedia({ audio: true, video: this.config.enableVideo })
      .then((stream) => {
        // Store MediaDevices access here to stop it when foreground is left
        // Do NOT stop MediaDevices access here (keep Mic/Camera access) to improve call startup time
        this.stream = stream

        if (this.config.enableVideo) {
          this.$refs.localVideo.srcObject = this.stream
        } else {
          this.$refs.localAudio.srcObject = this.stream
        }
        return stream
      })
      .catch((err) => {
        console.info(
          this.loggerPrefix + ': Could not access microphone/camera',
          err
        )
        this.alert(
          'To use the SIP widget you must allow microphone/camera access in your browser and reload this page.'
        )
        throw err
      })
  }

  attachMedia() {
    this.attachEvents()

    this.session.connection.addEventListener('track', (event) => {
      const track = event.track
      console.info(this.loggerPrefix + ': !! track kind:', track.kind)

      event.streams.forEach((stream) => {
        console.info(this.loggerPrefix + ': !! stream:', stream)
        this.$refs.remoteVideo.srcObject = stream
        this.$refs.remoteAudio.srcObject = stream
      })

      // switch (track.kind) {
      //   case "video":
      //     // Создаем новый MediaStream или используем существующий из event.streams[0]
      //     const videoStream = event.streams[0] || new MediaStream();
      //     videoStream.addTrack(track);
      //     this.$refs.remoteVideo.srcObject = videoStream;
      //     break;

      //   case "audio":
      //     // Создаем новый MediaStream или используем существующий из event.streams[0]
      //     const audioStream = event.streams[0] || new MediaStream();
      //     audioStream.addTrack(track);
      //     this.$refs.remoteAudio.srcObject = audioStream;
      //     break;

      //   default:
      //     console.warn(this.loggerPrefix + ": Unknown track kind:", track.kind);
      // }
    })
  }

  /**
   * Plays a given tone. Might not properly work on all browsers and devices.
   * @param {string} name file to be played
   */
  playTone(name) {
    if (this.config.enableTones === true) {
      console.info(this.loggerPrefix + ': Starting to play tone ' + name)
      const audio = this.$refs[name]
      if (!audio) {
        console.warn(this.loggerPrefix + ': NO tone ' + name)
        return
      }

      // PAUSE previous audio!
      // if (this.audio) this.audio.pause();
      this.audio = audio
      // this.audio.loop = true;
      // this.audio.load();
      this.audio.play().catch((error) => {
        console.info(this.loggerPrefix + ': Play tone: ' + String(error), error)
      })
    }
  }

  /**
   * Stops all played tones.
   */
  stopTones() {
    if (this.config.enableTones === true) {
      console.info(this.loggerPrefix + ': Stop playing tone')
      if (this.audio) this.audio.pause()
    }
  }

  async call(target) {
    console.info(
      this.loggerPrefix + ': Calling ' + this.remoteParty + ' ...',
      this.stream
    )
    // const stream = await this.attachLocalStream();
    await this.phone.call(target, {
      // mediaStream: stream,
      mediaConstraints: { audio: true, video: this.config.enableVideo },
    })
    this.attachMedia()
    this.playTone('ringBackAudio')
  }

  async answer() {
    this.stopTones()
    console.info(this.loggerPrefix + ': Answering')
    if (!this.session) throw new Error('No session found!')
    // const stream = await this.attachLocalStream();
    await this.session.answer({
      // mediaStream: stream,
      mediaConstraints: { audio: true, video: this.config.enableVideo },
      sessionTimersExpires: 90,
    })
    this.attachMedia()
  }

  async sendDTMF() {
    if (!this.session) throw new Error('No session found!')
    await this.session.sendDTMF(this.config.dtmfString, {
      duration: 160,
      interToneGap: 640,
    })
  }
}

async function onLoad() {
  window.phone = new SipPhone()
  window.phone.startForegroundActivity()
}

const BTN_STYLE = {
  border: 'solid 2px',
  padding: '5px 10px',
}

const PRE_STYLE: React.CSSProperties = {
  padding: '5px 10px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
}

const STATS_STYLE: React.CSSProperties = {
  padding: '5px 10px',
  wordBreak: 'break-all',
  fontSize: '8px',
}

const Page = () => {
  useEffect(() => {
    // patch console log
    ;(function () {
      function escape(htmlStr) {
        return String(htmlStr)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
      }
      const logger = document.getElementById('log')
      const consoleLog = console.log
      if ((console.log as any)._patched) return
      console.log =
        console.info =
        console.error =
          function () {
            consoleLog(...arguments)
            const args = [...arguments].filter(
              (x) => !(typeof x === 'string' && x.startsWith('color'))
            )
            const message = args[0]
            if (args.length === 1 && typeof args[0] === 'string') {
              logger.innerHTML += escape(message) + '\n'
            } else {
              try {
                logger.innerHTML += escape(JSON.stringify(args)) + '\n'
              } catch (e) {
                logger.innerHTML +=
                  '!! ' + escape(e) + ' !! ' + escape(message) + '\n'
              }
            }
          }
      ;(console.log as any)._patched = true
    })()
  }, [])

  return (
    <>
      <h1 id='title'>SipTest</h1>
      <div>Девайсы</div>
      <div id='device'></div>
      <div id='app'></div>
      <audio id='ringback' loop={true} src={ringback}>
        The “audio” tag is not supported by your browser.
      </audio>
      <audio id='ringtone' loop={true} src={ringtone}>
        The “audio” tag is not supported by your browser.
      </audio>
      <video id='localVideo' muted={true} playsInline={true} />
      <audio id='localAudio' />
      <video id='remoteVideo' muted={true} playsInline={true} />
      <audio id='remoteAudio' />
      <button onClick={() => window.phone.answer()} style={BTN_STYLE}>
        Answer
      </button>
      <button
        onClick={() => window.phone.call(parseFromUrl()['callTo'])}
        style={BTN_STYLE}
      >
        callTo:{parseFromUrl()['callTo']}
      </button>
      <button
        onClick={() => window.phone?.session?.terminate?.()}
        style={BTN_STYLE}
      >
        terminate:{parseFromUrl()['terminate']}
      </button>
      <div id='statsBox' style={STATS_STYLE} />
      <pre
        id='log'
        style={PRE_STYLE}
        onClick={() =>
          navigator.clipboard.writeText(
            document.getElementById('log')?.innerText
          )
        }
      />
      <Script
        src='https://unpkg.com/vconsole@latest/dist/vconsole.min.js'
        onLoad={() => {
          console.log('Script has loaded')
          onLoad()
          navigator.mediaDevices
            .enumerateDevices()
            .then((res) => {
              console.log('enumerateDevices', res)
              res.forEach((device) => {
                const deviceEl = document.getElementById('device')
                const result = `label: ${device.label} deviceId ${device.deviceId} "kind: "${device.kind} \n`
                if (deviceEl) {
                  deviceEl.innerText += result
                }
              })
            })
            .catch((err) => console.error('enumerateDevices', err))
        }}
      />
      <Script
        src='https://unpkg.com/vconsole@latest/dist/vconsole.min.js'
        onLoad={() => {
          // VConsole will be exported to `window.VConsole` by default. var
          var vConsole = new window.VConsole()
          const app = document.getElementById('app')

          const getPermissions = async () => {
            await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true,
            })
          }

          // const printDevices = async () => {
          //   await getPermissions();
          //   const devices = await navigator.mediaDevices.enumerateDevices();
          //   if (app) {
          //     app.innerText = JSON.stringify(devices, null, 2);
          //   }
          // };

          // printDevices();
        }}
      ></Script>
    </>
  )
}

// export default Page;
export default dynamic(() => Promise.resolve(Page), {
  ssr: false,
})
