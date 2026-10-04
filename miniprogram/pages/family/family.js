const repository = require('../../services/repository');

Page({
  data: { statusBarHeight: 20, members: [], currentRole: null, inviteCode: '', joinCode: '', loading: false },
  onLoad(options) {
    this.setData({
      statusBarHeight: getApp().globalData.layout.statusBarHeight,
      joinCode: options && options.code ? decodeURIComponent(options.code).trim().toUpperCase() : ''
    });
    this.loadMembers();
  },
  async loadMembers() {
    try { const profile = await repository.getProfile(); const roleNames = { admin: '管理员', editor: '可编辑', viewer: '仅查看' }; this.setData({ currentRole: profile.currentRole, members: profile.members.map(member => ({ ...member, initial: member.initial || member.nickname.slice(0, 1), roleName: roleNames[member.role] })) }); }
    catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
  },
  goBack() { wx.navigateBack(); },
  updateJoinCode(event) { this.setData({ joinCode: event.detail.value.trim().toUpperCase() }); },
  async createInvite() {
    try { const invite = await repository.createInvite(); this.setData({ inviteCode: invite.code }); }
    catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
  },
  async joinFamily() {
    if (!this.data.joinCode) return wx.showToast({ title: '请输入邀请码', icon: 'none' });
    this.setData({ loading: true });
    try { await repository.joinFamily(this.data.joinCode); wx.showToast({ title: '已加入家庭', icon: 'success' }); this.loadMembers(); }
    catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
    finally { this.setData({ loading: false }); }
  },
  changeRole(event) {
    const { id, role, nickname } = event.currentTarget.dataset;
    if (this.data.currentRole !== 'admin') return;
    if (role === 'admin') return wx.showToast({ title: '管理员权限不能在这里修改', icon: 'none' });
    wx.showActionSheet({
      itemList: ['可编辑', '仅查看'],
      success: async result => {
        const nextRole = result.tapIndex === 0 ? 'editor' : 'viewer';
        try { await repository.updateMemberRole(id, nextRole); await this.loadMembers(); wx.showToast({ title: `${nickname}权限已更新`, icon: 'success' }); }
        catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
      }
    });
  },
  onShareAppMessage() {
    if (!this.data.inviteCode) {
      return { title: '一起记录宝宝的成长', path: '/pages/index/index' };
    }
    return {
      title: '邀请你加入宝宝的成长空间',
      path: `/pages/family/family?code=${encodeURIComponent(this.data.inviteCode)}`
    };
  }
});
