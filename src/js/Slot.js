import Reel from "./Reel.js";
import Symbol from "./Symbol.js";

export default class Slot {
  constructor(domElement, config = {}) {
    Symbol.preload();

    this.balanceUI = document.getElementById("balance");
    this.betUI = document.getElementById("betValue");
    this.winUI = document.getElementById("win");

    this.balance = 0;
    this.betValue = 0.50;

    this.config = Object.assign({
      betStep: 0.50,
      betMin: 0.50,
      betMax: 1000000
    }, config);

    this.updateUI(0);

    this.currentSymbols = [
      ["avestruz","aguia","burro","borboleta","cachorro"],
      ["cabra","carneiro","camelo","cobra","coelho"],
      ["cavalo","elefante","galo","gato","jacare"],
      ["leao","macaco","porco","pavao","peru"],
      ["touro","tigre","urso","veado","vaca"],
    ];

    this.nextSymbols = JSON.parse(JSON.stringify(this.currentSymbols));

    this.container = domElement;

    this.reels = Array.from(
      this.container.getElementsByClassName("reel")
    ).map((reelContainer, idx) => new Reel(reelContainer, idx, this.currentSymbols[idx]));

    this.spinButton = document.getElementById("spin");
    this.spinButton.addEventListener("click", () => this.spin());

    this.autoPlayCheckbox = document.getElementById("autoplay");

    if (config.inverted) {
      this.container.classList.add("inverted");
    }

    window.slot = this;

    window.betMinus = () => {
      const step = parseFloat(this.config.betStep) || 0.5;
      const newBet = +(this.betValue - step).toFixed(2);
      this.betValue = Math.max(this.config.betMin, newBet);
      if (this.betValue > this.balance) {
        this.betValue = Math.min(this.betValue, this.balance);
      }
      this.updateUI(0);
    };

    window.betPlus = () => {
      const step = parseFloat(this.config.betStep) || 0.5;
      const newBet = +(this.betValue + step).toFixed(2);
      this.betValue = Math.min(this.config.betMax, newBet);
      this.updateUI(0);
    };
  }

  async init() {
    try {
      const resp = await fetch("https://ferrari-games-itech-io.onrender.com/rodar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet: this.betValue })
      });
      const result = await resp.json();
      if (result && result.grid) this.nextSymbols = result.grid;
      if (result && typeof result.balance_player !== "undefined") {
        this.balance = parseFloat(result.balance_player);
        this.updateUI(0);
      }
    } catch (err) {
      console.error(err);
    }
  }

  updateUI(winAmount) {
    if (this.balanceUI) this.balanceUI.textContent = "R$ " + this.balance.toFixed(2);
    if (this.betUI) this.betUI.textContent = "R$ " + this.betValue.toFixed(2);
    if (winAmount > 0 && this.winUI) {
      this.winUI.textContent = "R$ " + winAmount.toFixed(2);
      this.winUI.style.opacity = 0.50;
      setTimeout(() => { this.winUI.style.opacity = 0; }, 5000);
    }
    if (this.balance <= 0) this.showDepositMessage();
  }

  showDepositMessage() {
    if (document.getElementById("deposit-message")) return;
    const msg = document.createElement("div");
    msg.id = "deposit-message";
    msg.style.position = "absolute";
    msg.style.top = "50%";
    msg.style.left = "50%";
    msg.style.transform = "translate(-50%, -50%)";
    msg.style.background = "#333";
    msg.style.padding = "20px";
    msg.style.color = "white";    
    msg.style.border = "2px solid #000";
    msg.style.textAlign = "center";
    msg.style.width = "580px";
    msg.style.height = "auto";
   
    
    msg.innerHTML = `
      <p>Saldo insulficiente!!</p>
      <button id="deposit-btn">Ir para Depósitos</button>
    `;
    document.body.appendChild(msg);
    document.getElementById("deposit-btn").addEventListener("click", () => {
      window.location.href = "https://ferrari-games-itech-io.onrender.com/compras/users ";
      
      
    });
  }

  async spin() {
    if (this.balance < this.betValue) return;
    this.spinButton.disabled = true;

    let backend;
    try {
      const resp = await fetch("https://ferrari-games-itech-io.onrender.com/rodar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet: this.betValue })
      });
      backend = await resp.json();
    } catch (err) { console.error(err); }

    if (backend && backend.grid) {
      this.nextSymbols = backend.grid;
      if (typeof backend.balance_player !== "undefined") {
        this.balance = parseFloat(backend.balance_player);
      }
    } else {
      this.nextSymbols = this.currentSymbols.map(col => col.map(() => Symbol.random()));
    }

    this.onSpinStart(this.nextSymbols);

    await Promise.all(this.reels.map((reel) => {
      reel.renderSymbols(this.nextSymbols[reel.idx]);
      return reel.spin();
    }));

    if (backend && backend.wins) {
      backend.wins.forEach(win => this.highlightWin(win.positions));
    }

    let totalWin = backend && typeof backend.win !== "undefined" ? parseFloat(backend.win) : 0;
    this.updateUI(totalWin);
    this.onSpinEnd(backend && backend.wins ? backend.wins : []);
  }

  highlightWin(positions) {
    const linesLayer = document.getElementById("linesLayer") || this.createLinesLayer();
    linesLayer.innerHTML = "";
    positions.forEach(([c, r]) => {
      const reelEl = this.reels[c].symbolContainer.children[r];
      if (reelEl) reelEl.classList.add("win");
    });
  }

  createLinesLayer() {
    const layer = document.createElement("div");
    layer.id = "linesLayer";
    layer.style.position = "absolute";
    layer.style.top = "0";
    layer.style.left = "0";
    layer.style.width = "100%";
    layer.style.height = "100%";
    layer.style.pointerEvents = "none";
    layer.style.zIndex = "9999";
    this.container.appendChild(layer);
    return layer;
  }

  onSpinStart(symbols) { this.config.onSpinStart?.(symbols); }

  onSpinEnd(result) {
    this.config.onSpinEnd?.(result);
    this.spinButton.disabled = false;
    if (this.autoPlayCheckbox && this.autoPlayCheckbox.checked) {
      setTimeout(() => this.spin(), 200);
    }
  }
}
