import { render, screen } from '@testing-library/react'
import { TopFailCoursesTable } from './top-fail-courses'
import { describe, it, expect } from 'vitest'

describe('TopFailCoursesTable', () => {
  it('renders table headers and mock data correctly', () => {
    render(<TopFailCoursesTable />)

    expect(screen.getByText('Mã HP')).toBeInTheDocument()
    expect(screen.getByText('Tên môn')).toBeInTheDocument()
    expect(screen.getByText('Tỷ lệ trượt')).toBeInTheDocument()

    // check some course codes
    expect(screen.getByText('MATH101')).toBeInTheDocument()
    expect(screen.getByText('PHY101')).toBeInTheDocument()
    expect(screen.getByText('CS301')).toBeInTheDocument()

    // check some course names
    expect(screen.getByText('Giải tích 1')).toBeInTheDocument()
    expect(screen.getByText('Mạng máy tính')).toBeInTheDocument()
  })
})
