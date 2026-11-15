import { Text, View } from '@tarojs/components';
import type { ImportError } from '@kaoyan/domain';

export default function ImportResult({ result }: { result: { totalRows: number; successCount: number; errors: ImportError[] } }) {
  return <View className="card">
    <Text>共 {result.totalRows} 行，导入 {result.successCount} 个单词，{result.errors.length} 行未导入</Text>
    {result.errors.map((error) => <Text key={`${error.line}-${error.reason}`} style={{ display: 'block', marginTop: '8rpx' }}>
      第 {error.line} 行：{error.reason}
    </Text>)}
  </View>;
}
