import { render, screen } from '@testing-library/react'
import { AcademicTree, type TreeSelection } from './academic-tree'
import { describe, it, expect } from 'vitest'

describe('AcademicTree', () => {
  const departments = [
    {
      id: 'dept-1',
      tenKhoa: 'Công nghệ thông tin',
      moTa: 'Khoa CNTT',
      nganhs: [
        { id: 'major-1', tenNganh: 'Kỹ thuật phần mềm', khoaId: 'dept-1', moTa: 'Phát triển phần mềm' },
        { id: 'major-2', tenNganh: 'Mạng máy tính', khoaId: 'dept-1', moTa: 'Thiết kế mạng' },
      ],
    },
  ]

  const defaultSelection: TreeSelection = { id: 'dept-1', type: 'department' }

  it('renders department and major entries', () => {
    render(
      <AcademicTree
        departments={departments}
        studentCountByMajor={{ 'major-1': 25, 'major-2': 18 }}
        courseCountByDepartment={{ 'dept-1': 12 }}
        selected={defaultSelection}
        onSelect={() => undefined}
      />
    )

    expect(screen.getByText('Công nghệ thông tin')).toBeInTheDocument()
    expect(screen.getByText('Kỹ thuật phần mềm')).toBeInTheDocument()
    expect(screen.getByText('Mạng máy tính')).toBeInTheDocument()
    expect(screen.getByText('12 môn')).toBeInTheDocument()
    expect(screen.getByText('25 SV')).toBeInTheDocument()
  })
})
