Page({
  data: {
    entry: 'FE-001 bootstrap',
    sdkVersion: '',
  },

  onLoad(): void {
    const info = wx.getAppBaseInfo();
    this.setData({ sdkVersion: `SDK ${info.SDKVersion}` });
  },
});
