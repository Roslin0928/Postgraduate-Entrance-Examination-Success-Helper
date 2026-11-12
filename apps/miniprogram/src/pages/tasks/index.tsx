import { useCallback, useEffect, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import type { CreateTaskInput, TaskSummary } from '@kaoyan/domain';
import TaskCard from '../../components/TaskCard';
import TaskEditor from '../../components/TaskEditor';

const API = process.env.TARO_APP_API_BASE_URL ?? 'http://localhost:3000';
const today = () => new Date().toLocaleDateString('sv-SE');

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const token = Taro.getStorageSync('accessToken') as string;
  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const response = await Taro.request<TaskSummary[]>({ url: `${API}/v1/tasks?date=${today()}`, header: { Authorization: `Bearer ${token}` } });
      setTasks(response.data);
    } catch { Taro.showToast({ title: '任务加载失败', icon: 'none' }); }
    finally { setLoading(false); }
  }, [token]);
  useDidShow(() => { void load(); });
  useEffect(() => { void load(); }, [load]);

  const create = async (input: CreateTaskInput) => {
    await Taro.request({ url: `${API}/v1/tasks`, method: 'POST', header: { Authorization: `Bearer ${token}` }, data: input });
    await load();
  };
  const act = async (task: TaskSummary, action: string) => {
    if (action === 'start') { Taro.navigateTo({ url: `/pages/tasks/pomodoro?taskId=${task.id}` }); return; }
    await Taro.request({ url: `${API}/v1/tasks/${task.id}`, method: 'PATCH', header: { Authorization: `Bearer ${token}` }, data: { action } });
    await load();
  };

  const planned = tasks.reduce((sum, task) => sum + task.plannedMinutes, 0);
  const completed = tasks.reduce((sum, task) => sum + task.completedMinutes, 0);
  const done = tasks.filter((task) => task.status === 'completed').length;
  const rate = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const advice = tasks.length === 0 ? '先添加一个今天最重要的任务。' : rate >= 70 ? '进度不错，保持节奏并留出复盘时间。' : '先从最重要的一项开始，完成后再调整剩余计划。';

  if (!token) return <View className="page"><View className="card"><Text>登录后查看今日任务</Text><Button onClick={() => Taro.navigateTo({ url: '/pages/me/login' })}>去登录</Button></View></View>;
  return <View className="page">
    <View className="card">
      <Text>今日任务 · {today()}</Text>
      <View className="muted" style={{ marginTop: '16rpx' }}>预计 {planned} 分钟 · 已完成 {completed} 分钟 · 完成率 {rate}%</View>
      <View className="muted" style={{ marginTop: '12rpx' }}>{advice}</View>
    </View>
    <TaskEditor onCreate={create} />
    {loading ? <Text>加载中…</Text> : tasks.map((task) => <TaskCard key={task.id} task={task} onAction={(action) => void act(task, action)} />)}
  </View>;
}
