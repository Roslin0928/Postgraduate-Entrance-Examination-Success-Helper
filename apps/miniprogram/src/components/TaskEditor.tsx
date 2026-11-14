import { Button, Input, Picker, Text, View } from '@tarojs/components';
import { useState } from 'react';
import type { CreateTaskInput, TaskType } from '@kaoyan/domain';

const types: TaskType[] = ['custom', 'vocabulary', 'sentence', 'school_search'];

export default function TaskEditor({ onCreate }: { onCreate: (input: CreateTaskInput) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('25');
  const [typeIndex, setTypeIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const today = new Date().toLocaleDateString('sv-SE');
  return <View className="card">
    <Button size="mini" onClick={() => setOpen(!open)}>{open ? '收起' : '＋ 新建任务'}</Button>
    {open && <View style={{ marginTop: '20rpx' }}>
      <Input placeholder="任务名称" value={title} onInput={(event) => setTitle(event.detail.value)} />
      <Input type="number" value={minutes} onInput={(event) => setMinutes(event.detail.value)} style={{ marginTop: '16rpx' }} />
      <Picker mode="selector" range={types} onChange={(event) => setTypeIndex(Number(event.detail.value))}>
        <View style={{ marginTop: '16rpx' }}><Text>类型：{types[typeIndex]}</Text></View>
      </Picker>
      <Button type="primary" size="mini" style={{ marginTop: '20rpx' }} onClick={async () => {
        await onCreate({ title: title.trim(), type: types[typeIndex], plannedMinutes: Number(minutes), plannedDate: today, priority: 0 });
        setTitle(''); setOpen(false);
      }}>保存任务</Button>
    </View>}
  </View>;
}
