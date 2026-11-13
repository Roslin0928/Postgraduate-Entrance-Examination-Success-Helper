import { Button, Text, View } from '@tarojs/components';
import type { SentenceAnalysisView } from '@kaoyan/domain';

export default function SentenceResult({ item, onStatus, onRetry }: {
  item: SentenceAnalysisView;
  onStatus: (status: 'understood' | 'needs_review') => void;
  onRetry: () => void;
}) {
  return <View className="card">
    <Text className="section-title">原句</Text>
    <View className="muted" style={{ marginTop: '8rpx' }}>{item.original}</View>
    {item.status === 'pending' && <View style={{ marginTop: '16rpx' }}>分析中…</View>}
    {item.status === 'retryable' && <View style={{ marginTop: '16rpx' }}>
      <Text>分析暂时失败：{item.errorMessage || '请重试'}</Text>
      <Button size="mini" onClick={onRetry}>重试</Button>
    </View>}
    {item.status === 'completed' && <>
      <View style={{ marginTop: '16rpx' }}><Text className="section-title">句子主干</Text><View>{item.mainClause}</View></View>
      {item.mode === 'detailed' && <>
        <View style={{ marginTop: '16rpx' }}><Text className="section-title">分层结构</Text>
          {item.chunks.map((chunk, index) => <View key={`${index}-${chunk.text}`} className="list-row"><Text>{chunk.role}：{chunk.text}</Text></View>)}
        </View>
        <View style={{ marginTop: '16rpx' }}><Text className="section-title">语法解释</Text>
          {item.grammarPoints.map((point, index) => <View key={index} className="list-row">{point}</View>)}
        </View>
      </>}
      <View style={{ marginTop: '16rpx' }}><Text className="section-title">翻译</Text>
        <View>直译：{item.literalTranslation}</View><View style={{ marginTop: '8rpx' }}>意译：{item.naturalTranslation}</View>
      </View>
      <View style={{ display: 'flex', gap: '16rpx', marginTop: '20rpx' }}>
        <Button size="mini" onClick={() => onStatus('understood')}>已理解</Button>
        <Button size="mini" onClick={() => onStatus('needs_review')}>需要复习</Button>
      </View>
    </>}
  </View>;
}
