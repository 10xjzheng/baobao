const environment = require('./config/env');

App({
  onLaunch() {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    this.globalData.layout = {
      statusBarHeight: windowInfo.statusBarHeight || 20,
      navigationHeight: Math.max(44, menuButton.bottom - (windowInfo.statusBarHeight || 20) + menuButton.top - (windowInfo.statusBarHeight || 20))
    };

    if (wx.cloud && environment.CLOUD_ENV_ID) {
      wx.cloud.init({ env: environment.CLOUD_ENV_ID, traceUser: true });
      this.globalData.cloudReady = true;
    }
  },
  globalData: {
    cloudReady: false,
    layout: { statusBarHeight: 20, navigationHeight: 44 }
  }
});
