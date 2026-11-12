import { Button, Text, View } from '@tarojs/components';
import type { TaskSummary } from '@kaoyan/domain';

export default function TaskCard({ task, onAction }: { task: TaskSummary; onAction: (action: string) => void }) {
  return (
    <View className="card" style={{ marginBottom: '20rpx' }}>
      <View style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Text>{task.title}</Text><Text className="muted">{task.completedMinutes}/{task.plannedMinutes} 分钟</Text>
      </View>
      <View className="muted" style={{ marginTop: '12rpx' }}>优先级 {task.priority} · {task.status}</View>
      {task.status !== 'completed' && task.status !== 'skipped' && task.status !== 'rescheduled' && (
        <View style={{ display: 'flex', gap: '12rpx', marginTop: '20rpx' }}>
          <Button size="mini" onClick={() => onAction('start')}>开始</Button>
          <Button size="mini" onClick={() => onAction('pause')}>暂停</Button>
          <Button size="mini" onClick={() => onAction('complete')}>完成</Button>
          <Button size="mini" onClick={() => onAction('reschedule')}>顺延</Button>
        </View>
      )}
    </View>
  );
}
