const repository = require('../../services/repository');
const { decorateBaby } = require('../../utils/baby-display');

Page({
  data: { statusBarHeight: 20, baby: decorateBaby({ name: '乐乐', birthday: '', gender: 'unknown' }), members: [], reminder: {} },
  onLoad() { this.setData({ statusBarHeight: getApp().globalData.layout.statusBarHeight }); },
  onShow() { this.loadProfile(); },
  async loadProfile() {
    try {
      const profile = await repository.getProfile();
      const roleNames = { admin: '管理员', editor: '可编辑', viewer: '仅查看' };
      const baby = decorateBaby(profile.baby);
      this.setData({ ...profile, baby, babyInitial: profile.babyInitial || baby.name.slice(0, 1), members: profile.members.map(member => ({ ...member, initial: member.initial || member.nickname.slice(0, 1), roleName: roleNames[member.role] })) });
    } catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
  },
  openFamily() { wx.navigateTo({ url: '/pages/family/family' }); },
  openReminder() { wx.navigateTo({ url: '/pages/reminder/reminder' }); },
  openBabyProfile() { wx.navigateTo({ url: '/pages/baby-profile/baby-profile' }); }
});
