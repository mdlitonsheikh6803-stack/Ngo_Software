"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"

interface Member {
  id: string
  member_id: string
  name: string
  total_loans: number
}

interface Loan {
  id: string
  loan_id: string
  member_id: string
  amount: number
  interest_rate: number
  total_amount: number
  paid_amount: number
  remaining_amount: number
  issue_date: string
  due_date: string
  status: "active" | "paid" | "overdue"
  purpose: string
  members?: { name: string }
}

interface LoanPayment {
  id: string
  loan_id: string
  amount: number
  payment_date: string
  description: string
}

export default function LoansPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [payments, setPayments] = useState<LoanPayment[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoanDialogOpen, setIsLoanDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [selectedLoanId, setSelectedLoanId] = useState("")
  const [loanFormData, setLoanFormData] = useState({
    memberId: "",
    amount: "",
    interestRate: "",
    dueDate: "",
    purpose: "",
  })
  const [paymentFormData, setPaymentFormData] = useState({
    amount: "",
    description: "",
  })
  const supabase = createClient()

  const generateLoanId = () => {
    const existingLoans = loans.length
    return `LOAN${String(existingLoans + 1).padStart(4, "0")}`
  }

  const loadData = async () => {
    const [membersResult, loansResult, paymentsResult] = await Promise.all([
      supabase.from("members").select("id, member_id, name, total_loans").order("name"),
      supabase.from("loans").select("*, members(name)").order("issue_date", { ascending: false }),
      supabase.from("loan_payments").select("*").order("payment_date", { ascending: false }),
    ])

    if (membersResult.error) {
      console.error("[v0] Error loading members:", membersResult.error)
    } else {
      setMembers(membersResult.data || [])
    }

    if (loansResult.error) {
      console.error("[v0] Error loading loans:", loansResult.error)
    } else {
      setLoans(loansResult.data || [])
    }

    if (paymentsResult.error) {
      console.error("[v0] Error loading payments:", paymentsResult.error)
    } else {
      setPayments(paymentsResult.data || [])
    }
  }

  useEffect(() => {
    const auth = localStorage.getItem("ngo_auth")
    if (!auth) {
      router.push("/")
      return
    }

    loadData().then(() => setIsLoading(false))
  }, [router])

  const handleAddLoan = async () => {
    const amount = Number.parseFloat(loanFormData.amount)
    const interestRate = Number.parseFloat(loanFormData.interestRate)
    const totalAmount = amount + amount * (interestRate / 100)
    const loanId = generateLoanId()

    const { error: loanError } = await supabase.from("loans").insert({
      loan_id: loanId,
      member_id: loanFormData.memberId,
      amount,
      interest_rate: interestRate,
      total_amount: totalAmount,
      paid_amount: 0,
      remaining_amount: totalAmount,
      issue_date: new Date().toISOString(),
      due_date: new Date(loanFormData.dueDate).toISOString(),
      status: "active",
      purpose: loanFormData.purpose,
    })

    if (loanError) {
      console.error("[v0] Error adding loan:", loanError)
      return
    }

    // Update member's total loans
    const member = members.find((m) => m.id === loanFormData.memberId)
    if (member) {
      const { error: updateError } = await supabase
        .from("members")
        .update({
          total_loans: Number(member.total_loans) + totalAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", loanFormData.memberId)

      if (updateError) {
        console.error("[v0] Error updating member:", updateError)
      }
    }

    await loadData()
    setLoanFormData({ memberId: "", amount: "", interestRate: "", dueDate: "", purpose: "" })
    setIsLoanDialogOpen(false)
  }

  const handleAddPayment = async () => {
    const loan = loans.find((l) => l.id === selectedLoanId)
    if (!loan) return

    const paymentAmount = Number.parseFloat(paymentFormData.amount)

    const { error: paymentError } = await supabase.from("loan_payments").insert({
      loan_id: loan.id,
      amount: paymentAmount,
      payment_date: new Date().toISOString(),
      description: paymentFormData.description,
    })

    if (paymentError) {
      console.error("[v0] Error adding payment:", paymentError)
      return
    }

    // Update loan
    const newPaidAmount = Number(loan.paid_amount) + paymentAmount
    const newRemainingAmount = Number(loan.total_amount) - newPaidAmount
    const { error: loanUpdateError } = await supabase
      .from("loans")
      .update({
        paid_amount: newPaidAmount,
        remaining_amount: Math.max(0, newRemainingAmount),
        status: newRemainingAmount <= 0 ? "paid" : loan.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", loan.id)

    if (loanUpdateError) {
      console.error("[v0] Error updating loan:", loanUpdateError)
    }

    // Update member's total loans
    const member = members.find((m) => m.id === loan.member_id)
    if (member) {
      const { error: memberUpdateError } = await supabase
        .from("members")
        .update({
          total_loans: Math.max(0, Number(member.total_loans) - paymentAmount),
          updated_at: new Date().toISOString(),
        })
        .eq("id", member.id)

      if (memberUpdateError) {
        console.error("[v0] Error updating member:", memberUpdateError)
      }
    }

    await loadData()
    setPaymentFormData({ amount: "", description: "" })
    setIsPaymentDialogOpen(false)
  }

  const filteredLoans = loans.filter((loan) => {
    const memberName = loan.members?.name || ""
    return (
      memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.loan_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.purpose.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const totalLoansIssued = loans.reduce((sum, l) => sum + Number(l.total_amount), 0)
  const totalPaid = loans.reduce((sum, l) => sum + Number(l.paid_amount), 0)
  const totalOutstanding = loans.reduce((sum, l) => sum + Number(l.remaining_amount), 0)
  const activeLoans = loans.filter((l) => l.status === "active").length

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Loan Management</h1>
            <p className="text-gray-600 mt-1">Manage member loans and repayments</p>
          </div>
          <Dialog open={isLoanDialogOpen} onOpenChange={setIsLoanDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">Issue New Loan</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Issue New Loan</DialogTitle>
                <DialogDescription>Create a new loan for a member</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="member">Select Member</Label>
                  <Select
                    value={loanFormData.memberId}
                    onValueChange={(value) => setLoanFormData({ ...loanFormData, memberId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name} ({member.member_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Loan Amount ($)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={loanFormData.amount}
                    onChange={(e) => setLoanFormData({ ...loanFormData, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interestRate">Interest Rate (%)</Label>
                  <Input
                    id="interestRate"
                    type="number"
                    step="0.1"
                    value={loanFormData.interestRate}
                    onChange={(e) => setLoanFormData({ ...loanFormData, interestRate: e.target.value })}
                    placeholder="5.0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={loanFormData.dueDate}
                    onChange={(e) => setLoanFormData({ ...loanFormData, dueDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purpose">Purpose</Label>
                  <Input
                    id="purpose"
                    value={loanFormData.purpose}
                    onChange={(e) => setLoanFormData({ ...loanFormData, purpose: e.target.value })}
                    placeholder="Business expansion"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsLoanDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddLoan}
                  disabled={
                    !loanFormData.memberId ||
                    !loanFormData.amount ||
                    !loanFormData.interestRate ||
                    !loanFormData.dueDate
                  }
                >
                  Issue Loan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Issued</CardTitle>
              <span className="text-2xl">💵</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">${totalLoansIssued.toFixed(2)}</div>
              <p className="text-xs text-gray-600 mt-1">{loans.length} loans</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Paid</CardTitle>
              <span className="text-2xl">✅</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">${totalPaid.toFixed(2)}</div>
              <p className="text-xs text-gray-600 mt-1">{payments.length} payments</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Outstanding</CardTitle>
              <span className="text-2xl">⏳</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">${totalOutstanding.toFixed(2)}</div>
              <p className="text-xs text-gray-600 mt-1">Remaining balance</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active Loans</CardTitle>
              <span className="text-2xl">🏦</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{activeLoans}</div>
              <p className="text-xs text-gray-600 mt-1">In progress</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>All Loans ({filteredLoans.length})</CardTitle>
              <Input
                placeholder="Search loans..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sm:w-64"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredLoans.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No loans yet. Issue your first loan to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Loan ID</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Member</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Interest</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Paid</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Remaining</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Due Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLoans.map((loan) => (
                      <tr key={loan.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-mono text-sm font-semibold text-emerald-600">{loan.loan_id}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">{loan.members?.name}</div>
                          <div className="text-sm text-gray-500">{loan.purpose}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">${Number(loan.amount).toFixed(2)}</div>
                        </td>
                        <td className="py-3 px-4 text-gray-700">{loan.interest_rate}%</td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-emerald-600">${Number(loan.paid_amount).toFixed(2)}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-orange-600">${Number(loan.remaining_amount).toFixed(2)}</div>
                        </td>
                        <td className="py-3 px-4 text-gray-700">{new Date(loan.due_date).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              loan.status === "paid"
                                ? "default"
                                : loan.status === "overdue"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {loan.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {loan.status !== "paid" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedLoanId(loan.id)
                                setIsPaymentDialogOpen(true)
                              }}
                              className="text-emerald-600 hover:text-emerald-700"
                            >
                              Add Payment
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Loan Payment</DialogTitle>
              <DialogDescription>Add a payment for this loan</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedLoanId && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  {(() => {
                    const loan = loans.find((l) => l.id === selectedLoanId)
                    return loan ? (
                      <>
                        <div className="text-sm text-gray-600">Loan ID: {loan.loan_id}</div>
                        <div className="text-sm text-gray-600">Member: {loan.members?.name}</div>
                        <div className="text-sm font-semibold text-gray-900 mt-1">
                          Remaining: ${Number(loan.remaining_amount).toFixed(2)}
                        </div>
                      </>
                    ) : null
                  })()}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Payment Amount ($)</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  value={paymentFormData.amount}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentDescription">Description</Label>
                <Input
                  id="paymentDescription"
                  value={paymentFormData.description}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, description: e.target.value })}
                  placeholder="Monthly installment"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddPayment} disabled={!paymentFormData.amount}>
                Record Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
