const repository = require('../../services/repository');

const METRICS = {
  weight: { label: '体重', field: 'weight', unit: 'kg', color: '#57b878' },
  height: { label: '身高', field: 'height', unit: 'cm', color: '#d9a735' },
  head: { label: '头围', field: 'headCircumference', unit: 'cm', color: '#e47770' }
};

Page({
  data: { statusBarHeight: 20, metric: 'weight', range: 'month', metricLabel: '体重', unit: 'kg', latest: '--', delta: '--', records: [], visibleRecords: [], detailRecords: [], loading: true },
  onLoad() { this.setData({ statusBarHeight: getApp().globalData.layout.statusBarHeight }); },
  onShow() { this.loadRecords(); },
  async loadRecords() {
    this.setData({ loading: true });
    try { const records = await repository.listGrowthRecords(); this.setData({ records, loading: false }); this.updateMetric(this.data.metric); }
    catch (error) { this.setData({ loading: false }); wx.showToast({ title: error.message, icon: 'none' }); }
  },
  selectMetric(event) { this.updateMetric(event.currentTarget.dataset.metric); },
  selectRange(event) { this.setData({ range: event.currentTarget.dataset.range }, () => this.updateMetric(this.data.metric)); },
  filterRecords(records) {
    if (this.data.range === 'all') return records;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (this.data.range === 'week' ? 6 : 30));
    const cutoffText = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    return records.filter(record => String(record.measuredAt) >= cutoffText);
  },
  updateMetric(metricKey) {
    const metric = METRICS[metricKey];
    const visibleRecords = this.filterRecords(this.data.records);
    const hasValue = value => value !== null && value !== '' && typeof value !== 'undefined' && Number.isFinite(Number(value));
    const points = visibleRecords.filter(record => hasValue(record[metric.field])).map(record => ({ date: record.measuredAt, value: Number(record[metric.field]) }));
    const detailRecords = visibleRecords.slice().reverse().map(record => ({ ...record, metricValue: hasValue(record[metric.field]) ? record[metric.field] : '--' }));
    const latestPoint = points[points.length - 1];
    const previousPoint = points[points.length - 2];
    const delta = latestPoint && previousPoint ? latestPoint.value - previousPoint.value : null;
    this.setData({ metric: metricKey, metricLabel: metric.label, unit: metric.unit, latest: latestPoint ? latestPoint.value.toFixed(metricKey === 'weight' ? 2 : 1) : '--', delta: delta === null ? '--' : `${delta >= 0 ? '+' : ''}${delta.toFixed(metricKey === 'weight' ? 2 : 1)} ${metric.unit}`, visibleRecords, detailRecords, points }, () => this.drawChart(points, metric.color));
  },
  drawChart(points, color) {
    const context = wx.createCanvasContext('growthChart', this);
    const width = 320;
    const height = 210;
    context.setStrokeStyle('#e8ebe8'); context.setLineWidth(1);
    [40, 90, 140, 190].forEach(vertical => { context.beginPath(); context.moveTo(12, vertical); context.lineTo(width - 10, vertical); context.stroke(); });
    if (points.length < 2) { context.draw(); return; }
    const values = points.map(point => point.value); const minimum = Math.min(...values); const maximum = Math.max(...values); const range = maximum - minimum || 1;
    context.setStrokeStyle(color); context.setLineWidth(4); context.setLineCap('round'); context.beginPath();
    points.forEach((point, index) => { const x = 18 + index * ((width - 42) / Math.max(1, points.length - 1)); const y = height - 24 - ((point.value - minimum) / range) * (height - 60); if (index === 0) context.moveTo(x, y); else context.lineTo(x, y); });
    context.stroke(); context.setFillStyle('#ffffff'); context.setStrokeStyle(color); context.setLineWidth(3);
    points.forEach((point, index) => { const x = 18 + index * ((width - 42) / Math.max(1, points.length - 1)); const y = height - 24 - ((point.value - minimum) / range) * (height - 60); context.beginPath(); context.arc(x, y, 5, 0, Math.PI * 2); context.fill(); context.stroke(); });
    context.draw();
  },
  addRecord() { wx.navigateTo({ url: '/pages/growth-edit/growth-edit' }); },
  confirmDelete(event) {
    const id = event.currentTarget.dataset.id;
    wx.showModal({
      title: '删除这条成长记录？',
      content: '删除后成长曲线和首页最近体重会同步更新。',
      confirmText: '删除',
      confirmColor: '#D95C55',
      success: async result => {
        if (!result.confirm) return;
        try {
          await repository.deleteGrowth(id);
          await this.loadRecords();
          wx.showToast({ title: '记录已删除', icon: 'success' });
        } catch (error) {
          wx.showToast({ title: error.message || '删除失败', icon: 'none' });
        }
      }
    });
  }
});
