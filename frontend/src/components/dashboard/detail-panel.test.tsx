import { render, screen } from '@testing-library/react'
import { DetailPanel } from './detail-panel'
import { describe, it, expect } from 'vitest'

describe('DetailPanel', () => {
  it('renders metric cards and insight list correctly', () => {
    render(
      <DetailPanel
        title="Ngành Kỹ thuật phần mềm"
        subtitle="Phân tích điểm và KPI"
        studentCount={42}
        averageGpa={2.75}
        failRate={12.34}
        courseCount={15}
        topInsights={[
          'Cần tăng cường mentor cho sinh viên',
          'Ổn định kết quả học tập trong kỳ tới',
        ]}
      />
    )

    expect(screen.getByText('Ngành Kỹ thuật phần mềm')).toBeInTheDocument()
    expect(screen.getByText('Phân tích điểm và KPI')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('2.75')).toBeInTheDocument()
    expect(screen.getByText(/12\.3%/)).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('Cần tăng cường mentor cho sinh viên')).toBeInTheDocument()
    expect(screen.getByText('Ổn định kết quả học tập trong kỳ tới')).toBeInTheDocument()
  })
})
