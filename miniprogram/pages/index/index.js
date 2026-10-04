const repository = require('../../services/repository');
const quotes = require('../../utils/quotes');
const { decorateBaby } = require('../../utils/baby-display');
const QUOTE_INTERVAL_MS = 10 * 60 * 1000;

Page({
  data: {
    statusBarHeight: 20,
    loading: true,
    quote: quotes[0],
    baby: decorateBaby({ name: '乐乐', birthday: '', gender: 'unknown' }),
    feedCount: 0,
    feedAmount: 0,
    latestWeight: '--',
    nextReminder: '--:--',
    reminderText: '提醒未开启',
    timeline: [],
    needsOnboarding: false
  },
  onLoad() {
    this._quoteIndex = Math.floor(Math.random() * quotes.length);
    this._quoteUpdatedAt = Date.now();
    this.setData({
      statusBarHeight: getApp().globalData.layout.statusBarHeight,
      quote: quotes[this._quoteIndex]
    });
  },
  onShow() { this.loadData(); this.startQuoteRotation(); },
  onHide() { this.stopQuoteRotation(); },
  onUnload() { this.stopQuoteRotation(); },
  async onPullDownRefresh() {
    await this.loadData();
    wx.stopPullDownRefresh();
  },
  async loadData() {
    try {
      const dashboard = await repository.getDashboard();
      this.setData({
        ...dashboard,
        baby: decorateBaby(dashboard.baby),
        latestWeight: dashboard.latestWeight ? `${dashboard.latestWeight} kg` : '--',
        needsOnboarding: Boolean(dashboard.needsOnboarding),
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
    }
  },
  rotateQuote() {
    if (!quotes.length) return;
    const offset = quotes.length > 1 ? 1 + Math.floor(Math.random() * (quotes.length - 1)) : 0;
    this._quoteIndex = ((this._quoteIndex || 0) + offset) % quotes.length;
    this._quoteUpdatedAt = Date.now();
    this.setData({ quote: quotes[this._quoteIndex] });
  },
  startQuoteRotation() {
    this.stopQuoteRotation();
    const elapsed = Date.now() - (this._quoteUpdatedAt || 0);
    if (elapsed >= QUOTE_INTERVAL_MS) this.rotateQuote();
    const delay = Math.max(1000, QUOTE_INTERVAL_MS - (Date.now() - this._quoteUpdatedAt));
    this._quoteTimeout = setTimeout(() => {
      this.rotateQuote();
      this._quoteInterval = setInterval(() => this.rotateQuote(), QUOTE_INTERVAL_MS);
    }, delay);
  },
  stopQuoteRotation() {
    if (this._quoteTimeout) clearTimeout(this._quoteTimeout);
    if (this._quoteInterval) clearInterval(this._quoteInterval);
    this._quoteTimeout = null;
    this._quoteInterval = null;
  },
  addFeed() { wx.navigateTo({ url: '/pages/feed-edit/feed-edit' }); },
  addGrowth() { wx.navigateTo({ url: '/pages/growth-edit/growth-edit' }); },
  openReminder() { wx.navigateTo({ url: '/pages/reminder/reminder' }); },
  async createFamily() {
    try { await repository.createFamily({ babyName: '乐乐' }); await this.loadData(); wx.showToast({ title: '成长空间已创建', icon: 'success' }); }
    catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
  },
  joinFamily() { wx.navigateTo({ url: '/pages/family/family' }); }
});
