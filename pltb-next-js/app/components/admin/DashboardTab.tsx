'use client';

import { StatCard } from '@/app/components/admin/StatCard';
import { DashboardStats, UsageLog } from '@/app/types/admin.types';
import { formatDate } from '@/app/services/adminHelpers';

interface DashboardTabProps {
  stats: DashboardStats;
}

export const DashboardTab = ({ stats }: DashboardTabProps) => {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Pengguna Aktif"
          value={stats.totalUsers}
          subtitle="Seluruh pengguna"
          isFirst={true}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <StatCard
          title="Pengguna Aktif Hari Ini"
          value={stats.activeUsersToday}
          subtitle={`Dari ${stats.totalUsageToday} penggunaan`}
          isSecond={true}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />
        <StatCard
          title="Total Penggunaan Hari Ini"
          value={stats.totalUsageToday}
          subtitle="Seluruh fitur"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Locations */}
        <div className="group bg-white/80 backdrop-blur-sm rounded-xl border border-white/50 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden">
          <div className="relative p-5 pb-40">
            <h3 className="font-semibold text-[#003b33] mb-20 flex items-center gap-4">
              <div className="w-7 h-7 rounded-lg bg-linear-to-br from-[#00a991] to-[#008774] flex items-center justify-center shadow-md">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-base">Top Lokasi Penggunaan</span>
            </h3>
            <div className="space-y-2">
              {stats.topLocations.length > 0 ? (
                stats.topLocations.map((loc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-linear-to-r from-gray-50 to-white rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-[#00a991]/10 text-[#00a991]' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {idx + 1}
                      </div>
                      <span className="font-medium text-gray-700 text-sm">{loc.location}</span>
                    </div>
                    <span className="text-sm font-semibold text-[#00a991]">{loc.count} kali</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-center py-6 text-sm">Belum ada data penggunaan</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="group bg-white/80 backdrop-blur-sm rounded-xl border border-white/50 shadow-md hover:shadow-lg transition-all duration-300">
          <div className="p-5">
            <h3 className="font-semibold text-[#003b33] mb-20 flex items-center gap-6">
              <div className="w-7 h-7 rounded-lg bg-linear-to-br from-[#00a991] to-[#008774] flex items-center justify-center shadow-md">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-base">Aktivitas Terakhir</span>
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-2 custom-scroll">
              {stats.recentActivities.length > 0 ? (
                stats.recentActivities.map((activity: UsageLog) => (
                  <div key={activity.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 transition-all">
                    <div>
                      <p className="font-medium text-gray-700 text-sm">{activity.username}</p>
                      <p className="text-xs text-gray-400">{activity.featureName} • {activity.location}</p>
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(activity.timestamp)}</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-center py-6 text-sm">Belum ada aktivitas</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: #b0e4dd;
          border-radius: 10px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
          background: #00a991;
        }
      `}</style>
    </div>
  );
};