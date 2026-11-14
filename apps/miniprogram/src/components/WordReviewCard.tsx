import { Button, Text, View } from '@tarojs/components';
import type { ReviewFeedback } from '@kaoyan/domain';

export interface ReviewWord {
  id: string;
  word: string;
  meaning: string;
  source: string;
}

export default function WordReviewCard({ word, revealed, onReveal, onFeedback }: {
  word: ReviewWord;
  revealed: boolean;
  onReveal: () => void;
  onFeedback: (feedback: ReviewFeedback) => void;
}) {
  return <View className="card">
    <Text style={{ fontSize: '48rpx', fontWeight: 'bold' }}>{word.word}</Text>
    {revealed ? <Text style={{ display: 'block', marginTop: '24rpx' }}>{word.meaning}</Text> : <Button style={{ marginTop: '24rpx' }} onClick={onReveal}>显示释义</Button>}
    {revealed && <View style={{ display: 'flex', gap: '12rpx', marginTop: '28rpx' }}>
      <Button size="mini" onClick={() => onFeedback('known')}>认识</Button>
      <Button size="mini" onClick={() => onFeedback('fuzzy')}>模糊</Button>
      <Button size="mini" onClick={() => onFeedback('unknown')}>不认识</Button>
    </View>}
  </View>;
}
