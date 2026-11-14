import { useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';

const API = process.env.TARO_APP_API_BASE_URL ?? 'http://localhost:3000';
const today = () => new Date().toLocaleDateString('sv-SE');
const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
interface DayStats { date: string; plannedTasks: number; completedTasks: number; effectiveMinutes: number; vocabularyReviews: number; vocabularyFamiliarityChange: number; sentenceAnalyses: number }

export default function AnalyticsPage() {
  const [day, setDay] = useState<DayStats | null>(null);
  const [week, setWeek] = useState<DayStats[]>([]);
  const [loading, setLoading] = useState(true);
  const token = Taro.getStorageSync('accessToken') as string;
  const load = async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const header = { Authorization: `Bearer ${token}`, 'x-time-zone': timeZone() };
      const [daily, weekly] = await Promise.all([
        Taro.request<DayStats>({ url: `${API}/v1/analytics/daily?date=${today()}`, header }),
        Taro.request<{ days: DayStats[] }>({ url: `${API}/v1/analytics/weekly?date=${today()}`, header }),
      ]);
      setDay(daily.data); setWeek(weekly.data.days);
    } catch { Taro.showToast({ title: '统计加载失败，请重试', icon: 'none' }); }
    finally { setLoading(false); }
  };
  useDidShow(() => { void load(); });
  if (!token) return <View className="page"><View className="card"><Text>登录后查看学习统计</Text><Button onClick={() => Taro.navigateTo({ url: '/pages/me/login' })}>去登录</Button></View></View>;
  return <View className="page">
    <View className="card"><Text className="section-title">今日学习统计</Text>{loading ? <View className="muted" style={{ marginTop: '16rpx' }}>加载中…</View> : day && <>
      <View className="muted" style={{ marginTop: '16rpx' }}>完成率：{day.plannedTasks ? Math.round(day.completedTasks / day.plannedTasks * 100) : 0}%（{day.completedTasks}/{day.plannedTasks} 项）</View>
      <View className="muted" style={{ marginTop: '12rpx' }}>有效学习：{day.effectiveMinutes} 分钟</View>
      <View className="muted" style={{ marginTop: '12rpx' }}>词汇熟悉度变化：{day.vocabularyFamiliarityChange > 0 ? '+' : ''}{day.vocabularyFamiliarityChange}（复习 {day.vocabularyReviews} 次）</View>
      <View className="muted" style={{ marginTop: '12rpx' }}>长难句分析：{day.sentenceAnalyses} 次</View>
    </>}</View>
    <View className="section-title" style={{ margin: '24rpx 0 12rpx' }}>本周 · 周一至周日</View>
    {week.map((item) => <View className="card" key={item.date}><Text>{item.date}</Text><View className="muted" style={{ marginTop: '8rpx' }}>{item.completedTasks}/{item.plannedTasks} 项 · {item.effectiveMinutes} 分钟 · 单词 {item.vocabularyReviews} 次 · 长难句 {item.sentenceAnalyses} 次</View></View>)}
    <Button size="mini" onClick={() => void load()} disabled={loading}>刷新</Button>
  </View>;
}
