Page({
  data: {
    entry: 'FE-001 bootstrap',
    sdkVersion: '',
  },

  onLoad(): void {
    const info = wx.getAppBaseInfo();
    this.setData({ sdkVersion: `SDK ${info.SDKVersion}` });
  },

  onOpenProbe(): void {
    wx.navigateTo({ url: '/probes/runtime/index' });
  },

  onOpenLifecycle(): void {
    wx.navigateTo({ url: '/probes/lifecycle/index' });
  },
});
