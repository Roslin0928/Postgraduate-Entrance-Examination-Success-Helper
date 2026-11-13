import { useState } from 'react';
import { Button, Text, Textarea, View } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import type { SentenceAnalysisView, SentenceMode, SentenceUnderstandingStatus } from '@kaoyan/domain';
import SentenceResult from '../../components/SentenceResult';

const API = process.env.TARO_APP_API_BASE_URL ?? 'http://localhost:3000';

export default function SentencePage() {
  const [sentence, setSentence] = useState('');
  const [mode, setMode] = useState<SentenceMode>('detailed');
  const [history, setHistory] = useState<SentenceAnalysisView[]>([]);
  const [current, setCurrent] = useState<SentenceAnalysisView | null>(null);
  const [loading, setLoading] = useState(false);
  const token = Taro.getStorageSync('accessToken') as string;

  const loadHistory = async () => {
    if (!token) return;
    try {
      const response = await Taro.request<SentenceAnalysisView[]>({ url: `${API}/v1/sentence-analyses`, header: { Authorization: `Bearer ${token}` } });
      setHistory(response.data); if (current) setCurrent(response.data.find((item) => item.id === current.id) ?? current);
    } catch { Taro.showToast({ title: '历史加载失败', icon: 'none' }); }
  };
  useDidShow(() => { void loadHistory(); });

  const submit = async () => {
    if (!sentence.trim()) { Taro.showToast({ title: '请先粘贴英文句子', icon: 'none' }); return; }
    if (sentence.trim().length > 2000) { Taro.showToast({ title: '最多输入 2,000 个字符', icon: 'none' }); return; }
    setLoading(true);
    try {
      const response = await Taro.request<SentenceAnalysisView>({ url: `${API}/v1/sentence-analyses`, method: 'POST',
        header: { Authorization: `Bearer ${token}` }, data: { sentence, mode } });
      setCurrent(response.data); await loadHistory();
    } catch { Taro.showToast({ title: '提交失败，请重试', icon: 'none' }); }
    finally { setLoading(false); }
  };

  const retry = async (item: SentenceAnalysisView) => {
    setLoading(true);
    try {
      const response = await Taro.request<SentenceAnalysisView>({ url: `${API}/v1/sentence-analyses/${item.id}/retry`, method: 'POST', header: { Authorization: `Bearer ${token}` } });
      setCurrent(response.data); await loadHistory();
    } catch { Taro.showToast({ title: '重试失败，请稍后再试', icon: 'none' }); }
    finally { setLoading(false); }
  };

  const updateStatus = async (item: SentenceAnalysisView, status: SentenceUnderstandingStatus) => {
    try {
      const response = await Taro.request<SentenceAnalysisView>({ url: `${API}/v1/sentence-analyses/${item.id}/status`, method: 'PATCH',
        header: { Authorization: `Bearer ${token}` }, data: { status } });
      setCurrent(response.data); setHistory((items) => items.map((entry) => entry.id === item.id ? response.data : entry));
    } catch { Taro.showToast({ title: '状态保存失败', icon: 'none' }); }
  };

  if (!token) return <View className="page"><View className="card"><Text>登录后使用长难句分析</Text><Button onClick={() => Taro.navigateTo({ url: '/pages/me/login' })}>去登录</Button></View></View>;
  return <View className="page">
    <View className="card">
      <Text className="section-title">长难句分析</Text>
      <Textarea value={sentence} maxlength={2000} placeholder="粘贴考研英语句子" onInput={(event) => setSentence(event.detail.value)} style={{ minHeight: '180rpx', width: '100%', marginTop: '16rpx' }} />
      <View style={{ display: 'flex', gap: '16rpx', marginTop: '16rpx' }}>
        <Button size="mini" type={mode === 'brief' ? 'primary' : 'default'} onClick={() => setMode('brief')}>简版</Button>
        <Button size="mini" type={mode === 'detailed' ? 'primary' : 'default'} onClick={() => setMode('detailed')}>详细版</Button>
        <Button size="mini" disabled={loading} onClick={() => void submit()}>{loading ? '分析中…' : '开始分析'}</Button>
      </View>
      <View className="muted" style={{ marginTop: '12rpx' }}>{sentence.length}/2000</View>
    </View>
    {current && <SentenceResult item={current} onStatus={(status) => void updateStatus(current, status)} onRetry={() => void retry(current)} />}
    <View className="section-title" style={{ margin: '24rpx 0 12rpx' }}>分析历史</View>
    {history.length ? history.map((item) => <View key={item.id} onClick={() => setCurrent(item)}>
      <SentenceResult item={item} onStatus={(status) => void updateStatus(item, status)} onRetry={() => void retry(item)} />
    </View>) : <View className="card muted">暂无分析记录</View>}
  </View>;
}
