/**
 * network.js - Capa de comunicación en tiempo real para el aula
 * Conexión híbrida de 3 niveles:
 * 1. WebSocket local directo (0ms, para aula sin internet / misma red)
 * 2. MQTT en la nube (HiveMQ, para acceso remoto por datos móviles)
 * 3. BroadcastChannel (0ms, para pestañas de la misma computadora)
 */

class GameNetwork {
  constructor() {
    this.client = null;
    this.localWs = null;
    this.roomCode = "ARTE_CUBISMO_6TO";
    this.role = 'player'; // 'admin' o 'player'
    this.callbacks = {};
    this.isConnected = false;
    this.broadcastChannel = null;
    this.clientId = 'user_' + Math.random().toString(36).substring(2, 9);
    this.pendingQueue = [];
    this.seenMessages = new Set();
  }

  init(role = 'player') {
    this.role = role;
    this.setupLocalChannel();
    this.setupLocalWebSocket();
    this.connectMQTT();
  }

  // 1. CANAL LOCAL DE NAVEGADOR (BroadcastChannel)
  setupLocalChannel() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        if (this.broadcastChannel) this.broadcastChannel.close();
        this.broadcastChannel = new BroadcastChannel('cubismo_classroom_channel');
        this.broadcastChannel.onmessage = (event) => {
          this._handleIncomingMessage(event.data);
        };
      }
    } catch (e) {
      console.warn("BroadcastChannel error:", e);
    }
  }

  // 2. WEBSOCKET LOCAL DEL AULA (0ms, Offline, LAN/Hotspot)
  setupLocalWebSocket() {
    if (typeof WebSocket === 'undefined') return;
    const hostname = window.location.hostname || '';
    const isLocal = ['localhost', '127.0.0.1'].includes(hostname) || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
    if (!isLocal) {
      // En Vercel o hosting en la nube, la comunicación en tiempo real corre directamente por los brokers seguros WSS
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      if (!host) return;

      const wsUrl = `${protocol}//${host}/ws`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket local conectado al servidor del aula!");
        this.localWs = ws;
        this.isConnected = true;
        this.flushPendingQueue();
        if (this.callbacks['connected']) this.callbacks['connected']();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data._senderId !== this.clientId) {
            this._handleIncomingMessage(data);
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        this.localWs = null;
        setTimeout(() => this.setupLocalWebSocket(), 4000);
      };

      ws.onerror = () => {
        this.localWs = null;
      };
    } catch (e) {
      console.warn("Error iniciando WebSocket local:", e);
    }
  }

  // 3. MQTT EN LA NUBE (Vercel / Fallback con doble broker HiveMQ + EMQX)
  connectMQTT(brokerIndex = 0) {
    const brokers = [
      { host: "broker.hivemq.com", port: 8884, path: "/mqtt" },
      { host: "broker.emqx.io", port: 8084, path: "/mqtt" }
    ];

    const currentBroker = brokers[brokerIndex % brokers.length];
    if (typeof Paho !== 'undefined' && Paho.MQTT) {
      try {
        const client = new Paho.MQTT.Client(
          currentBroker.host,
          currentBroker.port,
          currentBroker.path,
          "cubismo_" + this.role + "_" + this.clientId
        );

        client.onConnectionLost = (responseObject) => {
          this.isConnected = this.localWs ? true : false;
          setTimeout(() => this.connectMQTT(brokerIndex + 1), 4000);
        };

        client.onMessageArrived = (message) => {
          try {
            const data = JSON.parse(message.payloadString);
            if (data._senderId !== this.clientId) {
              this._handleIncomingMessage(data);
            }
          } catch (err) {
            console.error("Error parseando MQTT:", err);
          }
        };

        const options = {
          useSSL: true,
          timeout: 6,
          keepAliveInterval: 30,
          cleanSession: true,
          onSuccess: () => {
            console.log(`MQTT conectado a la nube (${currentBroker.host})!`);
            this.isConnected = true;
            this.client = client;
            const topic = `arte6to/cubismo_v3/#`;
            client.subscribe(topic, { qos: 0 });

            this.flushPendingQueue();
            if (this.callbacks['connected']) this.callbacks['connected']();
          },
          onFailure: (err) => {
            console.warn(`Fallo en broker ${currentBroker.host}. Intentando alternativa...`, err);
            setTimeout(() => this.connectMQTT(brokerIndex + 1), 3000);
          }
        };

        client.connect(options);
      } catch (err) {
        console.warn("Error en cliente MQTT:", err);
        setTimeout(() => this.connectMQTT(brokerIndex + 1), 3000);
      }
    } else {
      this.isConnected = true;
      if (this.callbacks['connected']) this.callbacks['connected']();
    }
  }

  flushPendingQueue() {
    if (!this.pendingQueue || this.pendingQueue.length === 0) return;
    while (this.pendingQueue.length > 0) {
      const msg = this.pendingQueue.shift();
      if (this.localWs && this.localWs.readyState === 1) {
        this.localWs.send(JSON.stringify(msg));
      } else if (this.client && typeof this.client.isConnected === 'function' && this.client.isConnected()) {
        try {
          const pTopic = `arte6to/cubismo_v3/${this.role}`;
          const m = new Paho.MQTT.Message(JSON.stringify(msg));
          m.destinationName = pTopic;
          m.qos = 0;
          this.client.send(m);
        } catch (e) {}
      }
    }
  }

  send(action, payload = {}) {
    const messageObj = {
      action: action,
      payload: payload,
      _senderId: this.clientId,
      _role: this.role,
      _timestamp: Date.now()
    };

    // 1. Envío instantáneo local (misma máquina / pestañas)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(messageObj);
      } catch (e) {
        console.warn("BroadcastChannel error:", e);
      }
    }

    // 2. Envío por WebSocket local del servidor del aula (0ms)
    let sent = false;
    if (this.localWs && this.localWs.readyState === 1) { // 1 = OPEN
      try {
        this.localWs.send(JSON.stringify(messageObj));
        sent = true;
      } catch (e) {}
    }

    // 3. Envío por MQTT (nube)
    if (this.client && typeof this.client.isConnected === 'function' && this.client.isConnected()) {
      try {
        const topic = `arte6to/cubismo_v3/${this.role}`;
        const message = new Paho.MQTT.Message(JSON.stringify(messageObj));
        message.destinationName = topic;
        message.qos = 0;
        this.client.send(message);
        sent = true;
      } catch (e) {
        console.warn("Error enviando MQTT:", e);
      }
    }

    if (!sent) {
      if (!this.pendingQueue) this.pendingQueue = [];
      this.pendingQueue.push(messageObj);
    }
  }

  _handleIncomingMessage(data) {
    if (!data || !data.action) return;

    // Deduplicación de mensajes redundantes (WebSocket + MQTT + BroadcastChannel)
    const msgKey = `${data._senderId}_${data.action}_${data._timestamp}`;
    if (this.seenMessages.has(msgKey)) return;
    this.seenMessages.add(msgKey);
    setTimeout(() => this.seenMessages.delete(msgKey), 5000);

    const handler = this.callbacks[data.action];
    if (handler) {
      handler(data.payload, data);
    }
    if (this.callbacks['*']) {
      this.callbacks['*'](data.action, data.payload, data);
    }
  }

  on(action, callback) {
    this.callbacks[action] = callback;
  }
}

window.gameNetwork = new GameNetwork();
