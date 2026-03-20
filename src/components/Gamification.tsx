'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Challenge {
  id: string;
  name: string;
  description: string;
  type: string;
  target: number;
  current: number;
  progress: number;
  status: string;
  points: number;
  daysRemaining: number | null;
  isExpired: boolean;
}

interface Achievement {
  type: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

interface GamificationStats {
  points: number;
  streak: {
    current: number;
    longest: number;
    lastActivity: string | null;
  };
  stats: {
    transactions: number;
    goals: number;
    completedGoals: number;
    activeChallenges: number;
    completedChallenges: number;
    achievements: number;
  };
}

interface ChallengesData {
  challenges: Challenge[];
  templates: { name: string; description: string; type: string; target: number; points: number }[];
}

interface AchievementsData {
  achievements: Achievement[];
  stats: {
    total: number;
    unlocked: number;
    totalPoints: number;
  };
}

// Hook for gamification data
export function useGamification() {
  const queryClient = useQueryClient();

  // Fetch gamification stats
  const { data: stats, refetch: refetchStats } = useQuery<GamificationStats>({
    queryKey: ['gamification'],
    queryFn: async () => {
      const res = await fetch('/api/gamification');
      return res.json();
    },
  });

  // Fetch challenges
  const { data: challengesData, refetch: refetchChallenges } = useQuery<ChallengesData>({
    queryKey: ['challenges'],
    queryFn: async () => {
      const res = await fetch('/api/challenges');
      return res.json();
    },
  });

  // Fetch achievements
  const { data: achievementsData, refetch: refetchAchievements } = useQuery<AchievementsData>({
    queryKey: ['achievements'],
    queryFn: async () => {
      const res = await fetch('/api/achievements');
      return res.json();
    },
  });

  // Create challenge mutation
  const createChallenge = useMutation({
    mutationFn: async (data: { name: string; description: string; type: string; target: number; endDate?: string }) => {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, action: 'create' }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
  });

  // Add to challenge mutation
  const addToChallenge = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, amount, action: 'deposit' }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
  });

  // Record activity mutation
  const recordActivity = useMutation({
    mutationFn: async (action: string, data?: unknown) => {
      const res = await fetch('/api/gamification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
    },
  });

  // Unlock achievement mutation
  const unlockAchievement = useMutation({
    mutationFn: async ({ type, name }: { type: string; name: string }) => {
      const res = await fetch('/api/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
  });

  const refresh = useCallback(() => {
    refetchStats();
    refetchChallenges();
    refetchAchievements();
  }, [refetchStats, refetchChallenges, refetchAchievements]);

  return {
    stats,
    challenges: challengesData?.challenges || [],
    challengeTemplates: challengesData?.templates || [],
    achievements: achievementsData?.achievements || [],
    achievementStats: achievementsData?.stats,
    createChallenge,
    addToChallenge,
    recordActivity,
    unlockAchievement,
    refresh,
  };
}

// Gamification Panel Component
export function GamificationPanel({ 
  compact = false,
  onSelectSection 
}: { 
  compact?: boolean;
  onSelectSection?: (section: 'challenges' | 'achievements') => void;
}) {
  const { stats, challenges, achievements, achievementStats } = useGamification();

  if (!stats) return null;

  const activeChallenges = challenges.filter(c => c.status === 'active');
  const recentAchievements = achievements.filter(a => a.unlocked).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Points & Streak Card */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-4 text-white">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm opacity-80">Total Points</div>
            <div className="text-3xl font-bold">{stats.points.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <span className="text-2xl">🔥</span>
              <span className="text-2xl font-bold">{stats.streak.current}</span>
            </div>
            <div className="text-sm opacity-80">day streak</div>
          </div>
        </div>
        {stats.streak.longest > stats.streak.current && (
          <div className="mt-2 text-xs opacity-70">
            🏆 Longest: {stats.streak.longest} days
          </div>
        )}
      </div>

      {!compact && (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card rounded-xl p-3 text-center border">
              <div className="text-2xl">🎯</div>
              <div className="font-bold">{stats.stats.activeChallenges}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div className="bg-card rounded-xl p-3 text-center border">
              <div className="text-2xl">✅</div>
              <div className="font-bold">{stats.stats.completedChallenges}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="bg-card rounded-xl p-3 text-center border">
              <div className="text-2xl">🏆</div>
              <div className="font-bold">{achievementStats?.unlocked || 0}</div>
              <div className="text-xs text-muted-foreground">Badges</div>
            </div>
          </div>

          {/* Active Challenges Preview */}
          {activeChallenges.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Active Challenges</h3>
                <button 
                  onClick={() => onSelectSection?.('challenges')}
                  className="text-xs text-blue-600"
                >
                  View All
                </button>
              </div>
              <div className="space-y-2">
                {activeChallenges.slice(0, 2).map(c => (
                  <div key={c.id} className="bg-card rounded-xl p-3 border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-sm">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.daysRemaining !== null ? `${c.daysRemaining}d left` : ''}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.min(c.progress, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                      <span>${c.current.toFixed(0)} / ${c.target.toFixed(0)}</span>
                      <span>+{c.points} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Achievements */}
          {recentAchievements.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Recent Badges</h3>
                <button 
                  onClick={() => onSelectSection?.('achievements')}
                  className="text-xs text-blue-600"
                >
                  View All
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {recentAchievements.map(a => (
                  <div 
                    key={`${a.type}-${a.name}`}
                    className="flex-shrink-0 w-16 text-center"
                  >
                    <div className="text-3xl mb-1">{a.icon}</div>
                    <div className="text-xs truncate">{a.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Full Challenges View
export function ChallengesView() {
  const { challenges, challengeTemplates, createChallenge, addToChallenge } = useGamification();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);

  const activeChallenges = challenges.filter(c => c.status === 'active');
  const completedChallenges = challenges.filter(c => c.status === 'completed');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">💰 Savings Challenges</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold"
        >
          + New Challenge
        </button>
      </div>

      {/* Active Challenges */}
      {activeChallenges.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground">Active</h3>
          {activeChallenges.map(c => (
            <div key={c.id} className="bg-card rounded-2xl p-4 border shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.description}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">
                    {c.daysRemaining !== null ? `${c.daysRemaining} days left` : 'Ongoing'}
                  </div>
                  <div className="text-sm font-semibold text-purple-600">+{c.points} pts</div>
                </div>
              </div>
              
              <div className="h-3 bg-muted rounded-full overflow-hidden mb-2">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all"
                  style={{ width: `${Math.min(c.progress, 100)}%` }}
                />
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span>
                  <span className="font-semibold">${c.current.toFixed(0)}</span>
                  <span className="text-muted-foreground"> / ${c.target.toFixed(0)}</span>
                </span>
                <button
                  onClick={() => setActiveChallengeId(c.id)}
                  className="text-blue-600 font-semibold text-sm"
                >
                  + Add Funds
                </button>
              </div>

              {activeChallengeId === c.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    placeholder="Amount"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="flex-1 p-2 rounded-lg bg-muted border outline-none text-sm"
                  />
                  <button
                    onClick={() => {
                      if (depositAmount) {
                        addToChallenge.mutate({ id: c.id, amount: parseFloat(depositAmount) });
                        setDepositAmount('');
                        setActiveChallengeId(null);
                      }
                    }}
                    className="bg-green-600 text-white px-4 rounded-lg font-semibold text-sm"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setActiveChallengeId(null)}
                    className="text-muted-foreground px-2"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completed Challenges */}
      {completedChallenges.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground">Completed 🎉</h3>
          {completedChallenges.slice(0, 3).map(c => (
            <div key={c.id} className="bg-green-50 dark:bg-green-950 rounded-2xl p-4 border border-green-200 dark:border-green-800">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold text-green-700 dark:text-green-400">{c.name}</div>
                  <div className="text-xs text-green-600 dark:text-green-500">
                    ${c.target.toFixed(0)} saved • +{c.points} pts earned
                  </div>
                </div>
                <span className="text-2xl">✅</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Challenge Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-5 w-full max-w-sm max-h-[80vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-4">Choose a Challenge</h3>
            
            <div className="space-y-3 mb-4">
              {challengeTemplates.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedTemplate(selectedTemplate === i ? null : i)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedTemplate === i 
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950' 
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.description}</div>
                  <div className="text-xs text-purple-600 mt-1">+{t.points} points</div>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (selectedTemplate !== null) {
                    const template = challengeTemplates[selectedTemplate];
                    createChallenge.mutate({
                      name: template.name,
                      description: template.description,
                      type: template.type,
                      target: template.target,
                    });
                    setShowCreate(false);
                    setSelectedTemplate(null);
                  }
                }}
                disabled={selectedTemplate === null}
                className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-semibold disabled:opacity-50"
              >
                Start Challenge
              </button>
              <button
                onClick={() => { setShowCreate(false); setSelectedTemplate(null); }}
                className="flex-1 border py-2.5 rounded-xl font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Full Achievements View
export function AchievementsView() {
  const { achievements, achievementStats } = useGamification();
  
  const categories = [
    { type: 'streak', name: 'Streaks', icon: '🔥' },
    { type: 'first', name: 'First Steps', icon: '👶' },
    { type: 'savings', name: 'Savings', icon: '💰' },
    { type: 'budget', name: 'Budget', icon: '📊' },
    { type: 'milestone', name: 'Milestones', icon: '📈' },
    { type: 'goal', name: 'Goals', icon: '🎯' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">🏆 Achievements</h2>
        <div className="text-sm text-muted-foreground">
          {achievementStats?.unlocked || 0} / {achievementStats?.total || 0}
        </div>
      </div>

      {/* Progress */}
      <div className="bg-card rounded-2xl p-4 border">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-muted-foreground">Total Progress</span>
          <span className="font-semibold">{achievementStats?.totalPoints || 0} pts</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all"
            style={{ width: `${((achievementStats?.unlocked || 0) / (achievementStats?.total || 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Achievement Categories */}
      {categories.map(cat => {
        const catAchievements = achievements.filter(a => a.type === cat.type);
        const unlocked = catAchievements.filter(a => a.unlocked).length;
        
        return (
          <div key={cat.type}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{cat.icon}</span>
              <span className="font-semibold">{cat.name}</span>
              <span className="text-xs text-muted-foreground">({unlocked}/{catAchievements.length})</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              {catAchievements.map(a => (
                <div
                  key={`${a.type}-${a.name}`}
                  className={`rounded-xl p-3 text-center border ${
                    a.unlocked 
                      ? 'bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 border-yellow-300 dark:border-yellow-700' 
                      : 'bg-muted/50 opacity-50'
                  }`}
                >
                  <div className="text-2xl mb-1">{a.unlocked ? a.icon : '🔒'}</div>
                  <div className="text-xs font-medium truncate">{a.name}</div>
                  <div className="text-xs text-muted-foreground">+{a.points}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
