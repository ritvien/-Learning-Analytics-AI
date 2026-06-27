import { render, screen } from '@testing-library/react'
import { KpiWidgets } from './kpi-widgets'
import { describe, it, expect } from 'vitest'

describe('KpiWidgets', () => {
  it('renders all KPI widgets with correct values', () => {
    render(
      <KpiWidgets
        healthScore={85}
        gpaAvg={3.24}
        failRate={8.5}
        totalStudents={1250}
        totalCourses={85}
      />
    )

    expect(screen.getByText('Health Score')).toBeInTheDocument()
    expect(screen.getByText('85/100')).toBeInTheDocument()

    expect(screen.getByText('GPA Trung Bình')).toBeInTheDocument()
    expect(screen.getByText('3.24')).toBeInTheDocument()

    expect(screen.getByText('Tỷ lệ Trượt (Fail Rate)')).toBeInTheDocument()
    expect(screen.getByText('8.5%')).toBeInTheDocument()

    expect(screen.getByText('Môn học')).toBeInTheDocument()
    expect(screen.getByText('85')).toBeInTheDocument()

    expect(screen.getByText('Tổng Sinh Viên')).toBeInTheDocument()
    expect(screen.getByText('1.250')).toBeInTheDocument()
  })
})
