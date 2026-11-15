import { useEffect, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';

const API = process.env.TARO_APP_API_BASE_URL ?? 'http://localhost:3000';
const newEventId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function PomodoroPage() {
  const { params } = useRouter();
  const taskId = params.taskId ?? '';
  const token = Taro.getStorageSync('accessToken') as string;
  const [status, setStatus] = useState('loading');
  const [seconds, setSeconds] = useState(0);
  const [runningSince, setRunningSince] = useState(Date.now());
  const [ready, setReady] = useState(false);

  const send = async (action: 'start' | 'pause' | 'resume' | 'complete' | 'sync') => {
    const { data } = await Taro.request<{ status: string; effectiveSeconds: number; runningSince: string | null }>({
      url: `${API}/v1/tasks/${taskId}/pomodoro-events`, method: 'POST',
      header: { Authorization: `Bearer ${token}` }, data: { eventId: newEventId(), action },
    });
    setStatus(data.status); setSeconds(data.effectiveSeconds);
    if (data.runningSince) setRunningSince(new Date(data.runningSince).getTime());
  };
  useEffect(() => {
    if (!taskId || !token) return;
    void send('sync').catch(() => {
      setStatus('error');
      Taro.showToast({ title: '计时恢复失败，请重试', icon: 'none' });
    }).finally(() => setReady(true));
  }, [taskId]);
  useEffect(() => {
    if (status !== 'running') return;
    const timer = setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const exit = async () => {
    const result = await Taro.showModal({ title: '退出计时', content: '退出后任务不会自动标记为完成。' });
    if (result.confirm) { if (status === 'running') await send('pause'); Taro.navigateBack(); }
  };
  const displaySeconds = status === 'running' ? Math.max(seconds, Math.floor((Date.now() - runningSince) / 1000)) : seconds;
  const remaining = Math.max(0, 25 * 60 - displaySeconds);
  const clock = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  return <View className="page"><View className="card" style={{ textAlign: 'center', padding: '64rpx 24rpx' }}>
    <Text>{ready ? (status === 'error' ? '恢复失败' : status === 'planned' ? '尚未开始' : status === 'paused' ? '已暂停' : status === 'completed' ? '已完成' : '专注中') : '恢复计时中…'}</Text>
    <View style={{ fontSize: '96rpx', margin: '48rpx 0' }}>{clock}</View>
    {status === 'error' && <Button onClick={() => { setStatus('loading'); setReady(false); void send('sync').catch(() => setStatus('error')).finally(() => setReady(true)); }}>重试恢复</Button>}
    {status === 'planned' && <Button type="primary" onClick={() => void send('start')}>开始</Button>}
    {status === 'running' ? <Button onClick={() => void send('pause')}>暂停</Button> : status === 'paused' ? <Button type="primary" onClick={() => void send('resume')}>继续</Button> : null}
    {(status === 'running' || status === 'paused') && <Button style={{ marginTop: '20rpx' }} onClick={() => void send('complete')}>完成任务</Button>}
    <Button style={{ marginTop: '20rpx' }} onClick={() => void exit()}>退出计时</Button>
  </View></View>;
}
