const repository = require('../../services/repository');

const METRICS = {
  weight: { label: '体重', field: 'weight', unit: 'kg', color: '#57b878' },
  height: { label: '身高', field: 'height', unit: 'cm', color: '#d9a735' },
  head: { label: '头围', field: 'headCircumference', unit: 'cm', color: '#e47770' }
};

Page({
  data: { statusBarHeight: 20, metric: 'weight', today: '', startDate: '', endDate: '', metricLabel: '体重', unit: 'kg', latest: '--', delta: '--', records: [], visibleRecords: [], detailRecords: [], loading: true },
  onLoad() {
    const format = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 180);
    this.setData({ statusBarHeight: getApp().globalData.layout.statusBarHeight, today: format(end), startDate: format(start), endDate: format(end) });
  },
  onShow() { this.loadRecords(); },
  async loadRecords() {
    this.setData({ loading: true });
    try { const records = (await repository.listGrowthRecords()).slice().sort((a, b) => String(a.measuredAt).localeCompare(String(b.measuredAt))); this.setData({ records, loading: false }); this.updateMetric(this.data.metric); }
    catch (error) { this.setData({ loading: false }); wx.showToast({ title: error.message, icon: 'none' }); }
  },
  selectMetric(event) { this.updateMetric(event.currentTarget.dataset.metric); },
  updateRange(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }, () => this.updateMetric(this.data.metric)); },
  filterRecords(records) {
    const { startDate, endDate } = this.data;
    return records.filter(record => {
      const day = String(record.measuredAt);
      return (!startDate || day >= startDate) && (!endDate || day <= endDate);
    });
  },
  updateMetric(metricKey) {
    const metric = METRICS[metricKey];
    const decimals = metricKey === 'weight' ? 2 : 1;
    const visibleRecords = this.filterRecords(this.data.records);
    const hasValue = value => value !== null && value !== '' && typeof value !== 'undefined' && Number.isFinite(Number(value));
    const points = visibleRecords.filter(record => hasValue(record[metric.field])).map(record => ({ date: record.measuredAt, value: Number(record[metric.field]) }));
    const detailRecords = visibleRecords.slice().reverse().map(record => ({ ...record, metricValue: hasValue(record[metric.field]) ? record[metric.field] : '--' }));
    const latestPoint = points[points.length - 1];
    const previousPoint = points[points.length - 2];
    const delta = latestPoint && previousPoint ? latestPoint.value - previousPoint.value : null;
    this.setData({ metric: metricKey, metricLabel: metric.label, unit: metric.unit, latest: latestPoint ? latestPoint.value.toFixed(decimals) : '--', delta: delta === null ? '--' : `${delta >= 0 ? '+' : ''}${delta.toFixed(decimals)} ${metric.unit}`, visibleRecords, detailRecords, points }, () => this.drawChart(points, metric.color, decimals));
  },
  drawChart(points, color, decimals) {
    wx.createSelectorQuery().in(this).select('#growthChart').fields({ node: true, size: true }).exec(result => {
      const info = result && result[0];
      if (!info || !info.node) return;
      const canvas = info.node;
      const context = canvas.getContext('2d');
      let pixelRatio = 1;
      try { pixelRatio = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 1; } catch (error) { pixelRatio = 1; }
      const width = info.width;
      const height = info.height;
      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      context.scale(pixelRatio, pixelRatio);
      const left = 40;
      const right = 14;
      const top = 16;
      const bottom = 24;
      const plotWidth = width - left - right;
      const plotHeight = height - top - bottom;
      // 网格线
      context.strokeStyle = '#e8ebe8'; context.lineWidth = 1;
      [0, 0.5, 1].forEach(ratio => { const y = top + plotHeight - ratio * plotHeight; context.beginPath(); context.moveTo(left, y); context.lineTo(width - right, y); context.stroke(); });
      if (!points.length) return;
      const values = points.map(point => point.value);
      let minimum = Math.min(...values);
      let maximum = Math.max(...values);
      if (minimum === maximum) { minimum -= 1; maximum += 1; }
      const range = maximum - minimum;
      // 纵轴关键节点：最小值 / 中间值 / 最大值
      context.fillStyle = '#9aa39e'; context.font = '9px sans-serif'; context.textAlign = 'right'; context.textBaseline = 'middle';
      [0, 0.5, 1].forEach(ratio => { const y = top + plotHeight - ratio * plotHeight; context.fillText((minimum + ratio * range).toFixed(decimals), left - 6, y); });
      // 横轴按实际日期间隔等比映射，而不是按记录序号等距排列
      const timeOf = date => { const parts = String(date).split('-').map(Number); return parts.length >= 3 ? new Date(parts[0], parts[1] - 1, parts[2]).getTime() : 0; };
      const times = points.map(point => timeOf(point.date));
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const timeSpan = maxTime - minTime;
      const xOf = index => left + (timeSpan === 0 ? plotWidth / 2 : ((times[index] - minTime) / timeSpan) * plotWidth);
      const yOf = value => top + plotHeight - ((value - minimum) / range) * plotHeight;
      // 折线
      if (points.length > 1) {
        context.strokeStyle = color; context.lineWidth = 3; context.lineCap = 'round'; context.lineJoin = 'round'; context.beginPath();
        points.forEach((point, index) => { if (index === 0) context.moveTo(xOf(index), yOf(point.value)); else context.lineTo(xOf(index), yOf(point.value)); });
        context.stroke();
      }
      // 数据点
      context.lineWidth = 2.5; context.strokeStyle = color;
      points.forEach((point, index) => { context.beginPath(); context.arc(xOf(index), yOf(point.value), 4, 0, Math.PI * 2); context.fillStyle = '#ffffff'; context.fill(); context.stroke(); });
      // 横轴关键节点：首条 / 中间 / 末条记录的日期
      const formatDate = date => { const parts = String(date).split('-'); return parts.length >= 3 ? `${parts[1]}-${parts[2]}` : String(date); };
      const keyIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].filter((index, _, list) => {
        if (index === 0 || index === points.length - 1) return true;
        return Math.abs(xOf(index) - xOf(list[0])) > 36 && Math.abs(xOf(index) - xOf(list[list.length - 1])) > 36;
      });
      context.fillStyle = '#9aa39e'; context.font = '9px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'alphabetic';
      keyIndexes.forEach(index => context.fillText(formatDate(points[index].date), xOf(index), height - 6));
      // 标注最新一条记录的数值
      const lastIndex = points.length - 1;
      context.fillStyle = color; context.font = 'bold 10px sans-serif';
      context.fillText(points[lastIndex].value.toFixed(decimals), xOf(lastIndex), Math.max(yOf(points[lastIndex].value) - 10, 10));
    });
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
