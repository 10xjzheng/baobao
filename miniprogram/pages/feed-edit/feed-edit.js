const repository = require('../../services/repository');

function currentDateTime() {
  const date = new Date();
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return { day, time };
}

Page({
  data: { statusBarHeight: 20, type: 'breast', day: '', time: '', amount: '180', solidAmount: '', duration: '15', note: '', saving: false },
  onLoad() { const now = currentDateTime(); this.setData({ statusBarHeight: getApp().globalData.layout.statusBarHeight, ...now }); },
  goBack() { wx.navigateBack(); },
  setType(event) {
    const type = event.currentTarget.dataset.type;
    const updates = { type };
    if (type === 'mixed') { updates.duration = ''; updates.solidAmount = ''; }
    else if (type === 'breast' && this.data.duration === '') { updates.duration = '15'; }
    this.setData(updates);
  },
  updateField(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  async save() {
    if (this.data.saving) return;
    const amountText = String(this.data.amount).trim(); const durationText = String(this.data.duration).trim(); const solidText = String(this.data.solidAmount).trim();
    const amount = Number(amountText || 0); const duration = Number(durationText || 0); const solidAmount = Number(solidText || 0);
    const inRange = (value, minimum, maximum) => Number.isFinite(value) && value >= minimum && value <= maximum;
    if (this.data.type === 'mixed') {
      if ([amountText, durationText, solidText].filter(textValue => textValue !== '').length < 2) return wx.showToast({ title: '混合喂养请至少填写两项', icon: 'none' });
      if (amountText !== '' && !inRange(amount, 1, 1000)) return wx.showToast({ title: '奶量请输入 1–1000 ml', icon: 'none' });
      if (durationText !== '' && !inRange(duration, 1, 240)) return wx.showToast({ title: '时长请输入 1–240 分钟', icon: 'none' });
      if (solidText !== '' && !inRange(solidAmount, 1, 1000)) return wx.showToast({ title: '辅食量请输入 1–1000 ml', icon: 'none' });
    } else {
      if (this.data.type !== 'breast' && !inRange(amount, 1, 1000)) return wx.showToast({ title: `${this.data.type === 'solid' ? '食量' : '奶量'}请输入 1–1000 ml`, icon: 'none' });
      if (this.data.type === 'breast' && !inRange(duration, 1, 240)) return wx.showToast({ title: '时长请输入 1–240 分钟', icon: 'none' });
    }
    this.setData({ saving: true });
    try {
      const isMixed = this.data.type === 'mixed';
      await repository.createFeed({ type: this.data.type, amount: this.data.type === 'breast' ? 0 : amount, duration: this.data.type === 'breast' || isMixed ? duration : 0, solidAmount: isMixed ? solidAmount : 0, recordedAt: `${this.data.day} ${this.data.time}`, note: this.data.note.trim() });
      wx.showToast({ title: '记录已保存', icon: 'success' }); setTimeout(() => wx.navigateBack(), 650);
    } catch (error) { wx.showToast({ title: error.message, icon: 'none' }); this.setData({ saving: false }); }
  }
});
