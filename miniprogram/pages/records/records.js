const repository = require('../../services/repository');

Page({
  data: { statusBarHeight: 20, tab: 'feed', records: [], loading: true },
  onLoad() { this.setData({ statusBarHeight: getApp().globalData.layout.statusBarHeight }); },
  onShow() { this.loadRecords(); },
  async loadRecords() {
    try { this.setData({ records: await repository.listFeedRecords(), loading: false }); }
    catch (error) { this.setData({ loading: false }); wx.showToast({ title: error.message, icon: 'none' }); }
  },
  setTab(event) {
    const tab = event.currentTarget.dataset.tab;
    this.setData({ tab });
    if (tab === 'growth') wx.switchTab({ url: '/pages/growth/growth' });
  },
  addRecord() { wx.navigateTo({ url: '/pages/feed-edit/feed-edit' }); },
  confirmDelete(event) {
    const id = event.currentTarget.dataset.id;
    wx.showModal({
      title: '删除这条喂奶记录？',
      content: '删除后首页统计也会同步更新。',
      confirmText: '删除',
      confirmColor: '#D95C55',
      success: async result => {
        if (!result.confirm) return;
        try {
          await repository.deleteFeed(id);
          await this.loadRecords();
          wx.showToast({ title: '记录已删除', icon: 'success' });
        } catch (error) {
          wx.showToast({ title: error.message || '删除失败', icon: 'none' });
        }
      }
    });
  }
});
