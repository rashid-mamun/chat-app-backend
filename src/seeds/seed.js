const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Group = require('../models/Group');
const Message = require('../models/Message');
const logger = require('../utils/logger');

// Common password for all seeded users so any account can be logged into for testing
const DEFAULT_PASSWORD = 'Password123!@#';

// 32 Realistic User Personas with authentic details
const usersData = [
    {
        username: 'tanvir_hasan',
        email: 'tanvir.hasan@example.com',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        bio: 'Senior Full Stack Lead 🚀 | Building high-scale distributed systems | Node.js & React enthusiast',
        status: 'active',
        isOnline: true
    },
    {
        username: 'sultana_nisha',
        email: 'sultana.nisha@example.com',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        bio: 'Product Designer (UI/UX) 🎨 | Creating delightful experiences | Figma & Design Systems lover',
        status: 'active',
        isOnline: true
    },
    {
        username: 'arif_rahman',
        email: 'arif.rahman@example.com',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        bio: 'DevOps & Cloud Architect ☁️ | Kubernetes, Terraform & AWS | Coffee & Automation',
        status: 'active',
        isOnline: true
    },
    {
        username: 'mehnaz_chowdhury',
        email: 'mehnaz.c@example.com',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
        bio: 'Engineering Manager 💼 | Agile Coach | Passionate about mentoring and building great teams',
        status: 'active',
        isOnline: false
    },
    {
        username: 'sakib_al_amin',
        email: 'sakib.amin@example.com',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        bio: 'Mobile App Developer 📱 | Flutter & Swift | Amateur Street Photographer 📷',
        status: 'active',
        isOnline: true
    },
    {
        username: 'farhana_yasmin',
        email: 'farhana.y@example.com',
        avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
        bio: 'Frontend Specialist ✨ | Next.js, TailwindCSS, Web Animation | CSS art creator',
        status: 'active',
        isOnline: false
    },
    {
        username: 'rahul_sen',
        email: 'rahul.sen@example.com',
        avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
        bio: 'Backend Engineer ⚡ | Golang & Python | Microservices, RabbitMQ & Distributed Databases',
        status: 'active',
        isOnline: true
    },
    {
        username: 'anika_tabassum',
        email: 'anika.t@example.com',
        avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&auto=format&fit=crop&q=80',
        bio: 'QA & Automation Engineer 🧪 | Cypress, Playwright & Jest | Bug hunter extraordinaire 🐛',
        status: 'active',
        isOnline: true
    },
    {
        username: 'zubair_ahmed',
        email: 'zubair.ahmed@example.com',
        avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
        bio: 'Cybersecurity Analyst 🛡️ | Ethical Hacking, AppSec & Cryptography | CTF Player',
        status: 'active',
        isOnline: false
    },
    {
        username: 'priya_karmakar',
        email: 'priya.k@example.com',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
        bio: 'Data Scientist & ML Researcher 📊 | PyTorch, NLP, Generative AI | Reading Sci-Fi 📚',
        status: 'active',
        isOnline: true
    },
    {
        username: 'fahim_muntasir',
        email: 'fahim.m@example.com',
        avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
        bio: 'Full Stack Developer 💻 | MongoDB, Express, React, Node | Weekend Gamer 🎮',
        status: 'active',
        isOnline: true
    },
    {
        username: 'samira_akter',
        email: 'samira.a@example.com',
        avatar: 'https://images.unsplash.com/photo-1558898479-33c0057a5d12?w=150&auto=format&fit=crop&q=80',
        bio: 'Product Growth Manager 📈 | Data-driven decision maker | Coffee addict ☕',
        status: 'active',
        isOnline: false
    },
    {
        username: 'nahid_islam',
        email: 'nahid.islam@example.com',
        avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
        bio: 'Systems Engineer ⚙️ | Linux kernel nerd | Rust & C++ | Open Source Contributor',
        status: 'active',
        isOnline: true
    },
    {
        username: 'tania_khatun',
        email: 'tania.k@example.com',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        bio: 'Technical Content Strategist ✍️ | Developer Relations | Writing tech tutorials & guides',
        status: 'active',
        isOnline: false
    },
    {
        username: 'hasan_mahmud',
        email: 'hasan.m@example.com',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
        bio: 'Solutions Architect 🏗️ | Enterprise software | Football fanatic ⚽',
        status: 'active',
        isOnline: true
    },
    {
        username: 'rubaiya_islam',
        email: 'rubaiya.i@example.com',
        avatar: 'https://images.unsplash.com/photo-1548142813-c348350df52b?w=150&auto=format&fit=crop&q=80',
        bio: 'Junior Frontend Dev 🌱 | Learning TypeScript & Three.js | Anime & Manga lover 🌸',
        status: 'active',
        isOnline: true
    },
    {
        username: 'ashikur_rahman',
        email: 'ashikur.r@example.com',
        avatar: 'https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=150&auto=format&fit=crop&q=80',
        bio: 'Database Administrator 🗄️ | PostgreSQL & MongoDB performance tuning | Query optimizer',
        status: 'active',
        isOnline: false
    },
    {
        username: 'sumaiya_hossain',
        email: 'sumaiya.h@example.com',
        avatar: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80',
        bio: 'Brand Strategist & Visual Designer 🌺 | Typography, Illustration & Motion Design',
        status: 'active',
        isOnline: true
    },
    {
        username: 'kazi_tanvir',
        email: 'kazi.tanvir@example.com',
        avatar: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=150&auto=format&fit=crop&q=80',
        bio: 'Web3 & Blockchain Dev ⛓️ | Solidity, Smart Contracts & Zero Knowledge Proofs',
        status: 'active',
        isOnline: false
    },
    {
        username: 'nusrat_jahan',
        email: 'nusrat.jahan@example.com',
        avatar: 'https://images.unsplash.com/photo-1534751516642-a171edd30c77?w=150&auto=format&fit=crop&q=80',
        bio: 'Senior UX Researcher 🔍 | User interviews, Usability testing & Persona mapping',
        status: 'active',
        isOnline: true
    },
    {
        username: 'emran_hossain',
        email: 'emran.h@example.com',
        avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
        bio: 'FinTech Tech Lead 💳 | Payment gateways, High-throughput systems & Compliance',
        status: 'active',
        isOnline: true
    },
    {
        username: 'jannatul_ferdous',
        email: 'jannatul.f@example.com',
        avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
        bio: 'HR & Talent Partner 🤝 | Hiring top tech talent | Culture champion',
        status: 'active',
        isOnline: false
    },
    {
        username: 'siam_sarwar',
        email: 'siam.sarwar@example.com',
        avatar: 'https://images.unsplash.com/photo-1528892952291-009c663ce843?w=150&auto=format&fit=crop&q=80',
        bio: 'React Native & iOS Dev 📱 | Clean architecture | Fitness & Gym freak 🏋️',
        status: 'active',
        isOnline: true
    },
    {
        username: 'maliha_zaman',
        email: 'maliha.z@example.com',
        avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
        bio: 'Scrum Master & Agile Practitioner 🎯 | Sprint planning, continuous improvement',
        status: 'active',
        isOnline: true
    },
    {
        username: 'shahriar_kabir',
        email: 'shahriar.k@example.com',
        avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
        bio: 'AI & Computer Vision Researcher 🤖 | OpenCV, TensorRT, Robotics',
        status: 'active',
        isOnline: false
    },
    {
        username: 'lamia_anjum',
        email: 'lamia.a@example.com',
        avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&auto=format&fit=crop&q=80',
        bio: 'Frontend Architect 🏗️ | Micro-frontends, Vite, Module Federation & Performance',
        status: 'active',
        isOnline: true
    },
    {
        username: 'saif_ullah',
        email: 'saif.ullah@example.com',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        bio: 'Site Reliability Engineer (SRE) 🚨 | Prometheus, Grafana, On-call ninja 🥷',
        status: 'active',
        isOnline: true
    },
    {
        username: 'farzana_haque',
        email: 'farzana.h@example.com',
        avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
        bio: 'Graphic Designer & Illustrator 🎨 | Branding, Concept Art & Merch Design',
        status: 'active',
        isOnline: false
    },
    {
        username: 'adnan_sami',
        email: 'adnan.sami@example.com',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        bio: 'Full Stack & WebRTC Specialist 📹 | Real-time audio/video streaming & Socket.IO',
        status: 'active',
        isOnline: true
    },
    {
        username: 'shirin_shultana',
        email: 'shirin.s@example.com',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        bio: 'Customer Success & Support Lead 🌟 | Making users fall in love with our product',
        status: 'active',
        isOnline: true
    },
    {
        username: 'towhid_hasan',
        email: 'towhid.h@example.com',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        bio: 'Product Manager 🚀 | 0 to 1 Builder | Roadmaps, Metrics & User Value',
        status: 'active',
        isOnline: true
    },
    {
        username: 'nawshin_sabrina',
        email: 'nawshin.s@example.com',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
        bio: 'Creative Director 🌟 | Brand storytelling, digital media & typography nerd',
        status: 'active',
        isOnline: false
    }
];

// 8 Realistic Groups with distinct categories
const groupsTemplate = [
    {
        name: '🚀 Core Engineering & Tech Leads',
        privacy: 'public',
        avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80',
        adminIndex: 0, // tanvir_hasan
        memberIndices: [0, 2, 4, 6, 7, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28]
    },
    {
        name: '🎨 Product Design & UX System',
        privacy: 'public',
        avatar: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=150&auto=format&fit=crop&q=80',
        adminIndex: 1, // sultana_nisha
        memberIndices: [1, 3, 5, 9, 11, 15, 17, 19, 23, 27, 29, 31]
    },
    {
        name: '⚡ DevOps, SRE & Cloud Infra',
        privacy: 'public',
        avatar: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=150&auto=format&fit=crop&q=80',
        adminIndex: 2, // arif_rahman
        memberIndices: [2, 0, 6, 8, 12, 16, 20, 26]
    },
    {
        name: '☕ General Watercooler & Hangout',
        privacy: 'public',
        avatar: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=150&auto=format&fit=crop&q=80',
        adminIndex: 3, // mehnaz_chowdhury
        memberIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]
    },
    {
        name: '⚽ Weekend Sports & Futsal Club',
        privacy: 'public',
        avatar: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=150&auto=format&fit=crop&q=80',
        adminIndex: 14, // hasan_mahmud
        memberIndices: [14, 0, 4, 6, 10, 12, 18, 22, 26, 28, 30]
    },
    {
        name: '🎮 Gamers Lounge (Valorant & FIFA)',
        privacy: 'public',
        avatar: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=150&auto=format&fit=crop&q=80',
        adminIndex: 10, // fahim_muntasir
        memberIndices: [10, 4, 5, 8, 15, 22, 28, 30]
    },
    {
        name: '🧠 AI, Data Science & Research Hub',
        privacy: 'public',
        avatar: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=150&auto=format&fit=crop&q=80',
        adminIndex: 9, // priya_karmakar
        memberIndices: [9, 0, 6, 12, 24, 28]
    },
    {
        name: '💡 Startup Founders & Product Growth',
        privacy: 'private',
        avatar: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=150&auto=format&fit=crop&q=80',
        adminIndex: 30, // towhid_hasan
        memberIndices: [30, 0, 1, 3, 11, 20, 21, 23, 29, 31]
    }
];

// Helper to get time offset (hours/days ago)
const timeAgo = (hoursAgo, minutesAgo = 0) => {
    return new Date(Date.now() - (hoursAgo * 60 * 60 * 1000 + minutesAgo * 60 * 1000));
};

// 8 Rich Direct Conversations
const directConversations = [
    // Conversation 1: tanvir_hasan (0) & sultana_nisha (1) — UI Design Review
    {
        user1Idx: 0,
        user2Idx: 1,
        messages: [
            { sender: 1, text: "Hey Tanvir! Did you get a chance to review the new Figma components for the Chat App redesign?", time: timeAgo(48, 10) },
            { sender: 0, text: "Hey Nisha! Yes, I just went through the prototype. The new glassmorphism theme and dark mode tokens look phenomenal! 🔥", time: timeAgo(48, 2) },
            { sender: 1, text: "Awesome! I made sure the contrast ratios for the message bubbles adhere to WCAG AAA standards.", time: timeAgo(47, 50) },
            { sender: 0, text: "Love the attention to accessibility. Should we hop on a quick 10-minute huddle to finalize the emoji picker placement?", time: timeAgo(47, 40) },
            { sender: 1, text: "Sure! Let's do 3:30 PM. I'll share my screen and show the micro-interactions.", time: timeAgo(47, 30), reaction: '❤️' },
            { sender: 0, text: "Perfect, see you then! 👍", time: timeAgo(47, 28) },
            { sender: 1, text: "Uploaded the exported asset pack to Google Drive as well.", time: timeAgo(2, 15) },
            { sender: 0, text: "Got it, pulling the SVGs into the repo right now.", time: timeAgo(0, 10) }
        ]
    },

    // Conversation 2: tanvir_hasan (0) & arif_rahman (2) — DevOps & Redis Caching
    {
        user1Idx: 0,
        user2Idx: 2,
        messages: [
            { sender: 0, text: "Arif, how is the Kubernetes cluster scaling behaving under the Socket.IO load test?", time: timeAgo(36, 20) },
            { sender: 2, text: "Everything is green! CPU utilization stayed under 42% even with 50,000 concurrent socket connections.", time: timeAgo(36, 12) },
            { sender: 0, text: "That is huge! Did the Redis Pub/Sub adapter distribute message broadcasts across all worker pods properly?", time: timeAgo(36, 8) },
            { sender: 2, text: "Flawlessly. Latency averaged under 8ms for multi-room message fan-outs.", time: timeAgo(36, 2), reaction: '🔥' },
            { sender: 0, text: "Legendary work on tuning the memory buffers, Arif!", time: timeAgo(35, 50) },
            { sender: 2, text: "Thanks Tanvir! I added Grafana alerts on the Discord webhook as well just in case.", time: timeAgo(1, 40) }
        ]
    },

    // Conversation 3: mehnaz_chowdhury (3) & tanvir_hasan (0) — Sprint Planning & Architecture
    {
        user1Idx: 3,
        user2Idx: 0,
        messages: [
            { sender: 3, text: "Good morning Tanvir! Are we ready for the Q3 release candidate demo tomorrow?", time: timeAgo(24, 0) },
            { sender: 0, text: "Good morning Mehnaz! Yes, all 14 bug fixes and 10 UI enhancements have passed unit and integration test suites (100% pass rate).", time: timeAgo(23, 50) },
            { sender: 3, text: "Fantastic! The stakeholders are very excited about the real-time presence indicators and end-to-end typing status.", time: timeAgo(23, 40), reaction: '👍' },
            { sender: 0, text: "We also optimized the database queries so conversation list loads in less than 40ms.", time: timeAgo(23, 30) },
            { sender: 3, text: "Super proud of the team. Let's do a celebratory team lunch this Friday! 🍕", time: timeAgo(23, 20), reaction: '🔥' }
        ]
    },

    // Conversation 4: sakib_al_amin (4) & farhana_yasmin (5) — Mobile Flutter & Responsive Web
    {
        user1Idx: 4,
        user2Idx: 5,
        messages: [
            { sender: 4, text: "Farhana, are you using CSS Container Queries or standard media queries for the mobile chat sidebar drawer?", time: timeAgo(18, 15) },
            { sender: 5, text: "We're using CSS custom properties with a 1024px desktop breakpoint and fluid clamp() for typography!", time: timeAgo(18, 5) },
            { sender: 4, text: "Nice! I'm matching that exact spring curve in the Flutter drawer animation.", time: timeAgo(17, 50) },
            { sender: 5, text: "Awesome, consistency between web and mobile feels so good.", time: timeAgo(17, 30), reaction: '❤️' }
        ]
    },

    // Conversation 5: rahul_sen (6) & priya_karmakar (9) — AI Embeddings & Vector Search
    {
        user1Idx: 6,
        user2Idx: 9,
        messages: [
            { sender: 9, text: "Rahul, I just finished benchmarking the embedding model for message semantic search.", time: timeAgo(14, 20) },
            { sender: 6, text: "How fast is the cosine similarity calculation across 100k message vectors?", time: timeAgo(14, 10) },
            { sender: 9, text: "With HNSW indexing in MongoDB Atlas Vector Search, it takes around 12ms per query!", time: timeAgo(14, 2), reaction: '😮' },
            { sender: 6, text: "That is blazing fast. I will integrate the search endpoint into the backend API right away.", time: timeAgo(13, 50) }
        ]
    },

    // Conversation 6: hasan_mahmud (14) & fahim_muntasir (10) — Weekend Futsal
    {
        user1Idx: 14,
        user2Idx: 10,
        messages: [
            { sender: 14, text: "Fahim, are you playing in this Friday's 7-a-side futsal match at Dhanmondi turf?", time: timeAgo(8, 0) },
            { sender: 10, text: "Count me in 100%! What time is kickoff?", time: timeAgo(7, 45) },
            { sender: 14, text: "7:00 PM under the floodlights. Bring your indoor cleats!", time: timeAgo(7, 30), reaction: '🔥' },
            { sender: 10, text: "Will do! I'll bring an extra pair of goalie gloves as well.", time: timeAgo(7, 20) }
        ]
    },

    // Conversation 7: towhid_hasan (30) & sultana_nisha (1) — User Feedback & Metrics
    {
        user1Idx: 30,
        user2Idx: 1,
        messages: [
            { sender: 30, text: "Nisha, user satisfaction scores jumped from 4.2 to 4.9 stars after your latest UI overhaul!", time: timeAgo(5, 30) },
            { sender: 1, text: "Wow, that is so rewarding to hear! The feedback on the intuitive message reactions and clean typography has been super positive.", time: timeAgo(5, 15), reaction: '❤️' },
            { sender: 30, text: "Users specifically mentioned that the dark mode aesthetics feel super sleek and premium.", time: timeAgo(4, 50) }
        ]
    },

    // Conversation 8: adnan_sami (28) & tanvir_hasan (0) — WebRTC Screen Sharing
    {
        user1Idx: 28,
        user2Idx: 0,
        messages: [
            { sender: 28, text: "Tanvir, WebRTC peer-to-peer audio/video calling is working smoothly across Chrome, Firefox and Safari!", time: timeAgo(3, 0) },
            { sender: 0, text: "Incredible! Does the STUN/TURN fallback handle symmetric NAT connections without dropping packets?", time: timeAgo(2, 45) },
            { sender: 28, text: "Yes, Coturn server handles relay seamlessly with zero latency degradation.", time: timeAgo(2, 30), reaction: '🔥' },
            { sender: 0, text: "Outstanding achievement, Adnan. Let's merge the branch into staging.", time: timeAgo(0, 25) }
        ]
    }
];

// Group Discussions & Threads
const groupDiscussions = [
    // Group 0: Core Engineering & Tech Leads
    {
        groupIndex: 0,
        threads: [
            { senderIdx: 0, text: "📢 TEAM ANNOUNCEMENT: Production migration scheduled for tonight at 2:00 AM UTC. All health checks and rollback scripts are verified.", time: timeAgo(24), isPinned: true, reaction: '👍' },
            { senderIdx: 2, text: "DevOps team is on standby. All database replica sets have completed automated snapshots.", time: timeAgo(23, 50), reaction: '🔥' },
            { senderIdx: 6, text: "Backend service rate limiters and Redis token pools are warmed up and verified.", time: timeAgo(23, 40) },
            { senderIdx: 8, text: "Penetration testing on the new auth endpoints completed with 0 critical/high findings.", time: timeAgo(23, 30), reaction: '👍' },
            { senderIdx: 7, text: "Automated regression suite passed all 163 backend test scenarios.", time: timeAgo(23, 10), reaction: '🔥' },
            { senderIdx: 0, text: "Thank you everyone for the thorough preparation. Let's make this seamless!", time: timeAgo(22, 55) }
        ]
    },

    // Group 1: Product Design & UX System
    {
        groupIndex: 1,
        threads: [
            { senderIdx: 1, text: "🎨 Hey team! Design System v2.4 has been published to Figma. Major updates: modern font pairing (Inter + Outfit), tailored HSL tokens, and smooth cubic-bezier transitions.", time: timeAgo(16), isPinned: true, reaction: '❤️' },
            { senderIdx: 5, text: "Just pulled the new tokens into our CSS custom properties! The dark mode gradient contrast is stunning.", time: timeAgo(15, 45), reaction: '🔥' },
            { senderIdx: 17, text: "The new SVG icon library scales so crisply on Retina and 4K displays.", time: timeAgo(15, 30) },
            { senderIdx: 19, text: "User testing participants loved the micro-animation on the empty chat state icon.", time: timeAgo(15, 10), reaction: '❤️' },
            { senderIdx: 1, text: "Huge thanks to everyone for the creative energy! 🚀", time: timeAgo(14, 50) }
        ]
    },

    // Group 3: General Watercooler & Hangout
    {
        groupIndex: 3,
        threads: [
            { senderIdx: 3, text: "Good morning team! Happy Friday! ☕ Who is up for ordering specialty coffee from North End today?", time: timeAgo(8), reaction: '❤️' },
            { senderIdx: 0, text: "Double espresso for me please! 🙋‍♂️", time: timeAgo(7, 55), reaction: '🔥' },
            { senderIdx: 1, text: "Spanish Iced Latte with oat milk for me! 🥰", time: timeAgo(7, 50), reaction: '❤️' },
            { senderIdx: 4, text: "Cold brew with vanilla syrup! 🥤", time: timeAgo(7, 45) },
            { senderIdx: 10, text: "Caramel Macchiato please! 🙏", time: timeAgo(7, 40) },
            { senderIdx: 3, text: "Order placed! Delivery expected in 25 minutes to the 4th floor lounge.", time: timeAgo(7, 30), reaction: '🔥' }
        ]
    },

    // Group 4: Weekend Sports & Futsal Club
    {
        groupIndex: 4,
        threads: [
            { senderIdx: 14, text: "⚽ Friday Futsal Lineup: Team Red vs Team Blue! Kickoff at 7:00 PM sharp.", time: timeAgo(12), isPinned: true, reaction: '🔥' },
            { senderIdx: 10, text: "I'll be playing midfield for Team Blue! 🏃‍♂️", time: timeAgo(11, 40) },
            { senderIdx: 22, text: "Team Red is taking the trophy this week for sure! 🏆", time: timeAgo(11, 20), reaction: '😂' },
            { senderIdx: 26, text: "Bring hydration drinks guys, weather forecast says 28°C with humidity.", time: timeAgo(10, 50) }
        ]
    },

    // Group 6: AI, Data Science & Research Hub
    {
        groupIndex: 6,
        threads: [
            { senderIdx: 9, text: "🧠 Paper of the week: 'Efficient Attention Mechanisms for Real-Time On-Device Language Models'. Sharing the PDF summary below.", time: timeAgo(20), isPinned: true, reaction: '👍' },
            { senderIdx: 24, text: "The quantization benchmarks on Apple Silicon M-series in section 4 are mind blowing.", time: timeAgo(19, 30) },
            { senderIdx: 0, text: "Could we leverage this for client-side auto-complete suggestions in the chat composer?", time: timeAgo(19, 10), reaction: '😮' },
            { senderIdx: 9, text: "Yes! ONNX runtime in WebAssembly can run this directly in the browser with <15ms latency.", time: timeAgo(18, 40), reaction: '🔥' }
        ]
    },

    // Group 7: Startup Founders & Product Growth
    {
        groupIndex: 7,
        threads: [
            { senderIdx: 30, text: "🚀 Milestone update: We crossed 50,000 active monthly chat users with 99.98% uptime SLA!", time: timeAgo(10), isPinned: true, reaction: '🔥' },
            { senderIdx: 0, text: "Huge congratulations to the entire engineering, design and product team!", time: timeAgo(9, 45), reaction: '❤️' },
            { senderIdx: 11, text: "Day 30 user retention cohort is at an all-time high of 68%.", time: timeAgo(9, 20), reaction: '👍' },
            { senderIdx: 30, text: "Keep building with high standards. The future is bright! ✨", time: timeAgo(8, 50) }
        ]
    }
];

async function seedDatabase() {
    const isCleanMode = process.argv.includes('--clean') || process.argv.includes('--reset') || process.env.SEED_RESET === 'true';

    try {
        console.log('🔄 Connecting to MongoDB for seeding...');
        const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chatapp';

        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
        });

        console.log(`✅ Connected to MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}`);

        if (isCleanMode) {
            console.log('🧹 Clean mode active: wiping old collections...');
            await Promise.all([
                User.deleteMany({}),
                Group.deleteMany({}),
                Message.deleteMany({})
            ]);
            console.log('✨ Collections reset successfully.');
        } else {
            console.log('🛡️ Idempotent Mode: Checking and updating existing data without creating duplicates...');
        }

        // Hash password once for performance
        console.log('🔑 Preparing default password hash for all users...');
        const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);

        // 1. Idempotent User Upsert
        console.log(`👤 Syncing ${usersData.length} realistic user profiles...`);
        const userMap = new Map(); // username -> User Document
        const createdUsers = [];

        for (const u of usersData) {
            const lastSeenTime = u.isOnline ? new Date() : timeAgo(Math.floor(Math.random() * 48) + 1, Math.floor(Math.random() * 59));

            let userDoc = await User.findOne({ $or: [{ email: u.email }, { username: u.username }] });

            if (userDoc) {
                // Update existing user without duplicate key error
                userDoc.username = u.username;
                userDoc.email = u.email;
                userDoc.avatar = u.avatar;
                userDoc.bio = u.bio;
                userDoc.status = u.status;
                userDoc.isOnline = u.isOnline;
                userDoc.lastSeen = lastSeenTime;
                userDoc.password = DEFAULT_PASSWORD;
                await userDoc.save({ validateBeforeSave: false });
            } else {
                // Create new user
                userDoc = new User({
                    username: u.username,
                    email: u.email,
                    password: DEFAULT_PASSWORD,
                    avatar: u.avatar,
                    bio: u.bio,
                    status: u.status,
                    isOnline: u.isOnline,
                    lastSeen: lastSeenTime
                });
                await userDoc.save({ validateBeforeSave: false });
            }

            userMap.set(u.username, userDoc);
            createdUsers.push(userDoc);
        }
        console.log(`✅ ${createdUsers.length} users verified & synced without duplicates!`);

        // 2. Idempotent Group Upsert
        console.log(`👥 Syncing ${groupsTemplate.length} community & team groups...`);
        const createdGroups = [];

        for (const grp of groupsTemplate) {
            const adminUser = createdUsers[grp.adminIndex];
            const memberUsers = grp.memberIndices.map(idx => createdUsers[idx]._id);

            let groupDoc = await Group.findOne({ name: grp.name });

            if (groupDoc) {
                // Update existing group
                groupDoc.privacy = grp.privacy;
                groupDoc.avatar = grp.avatar;
                groupDoc.admins = [adminUser._id];
                groupDoc.members = memberUsers;
                await groupDoc.save();
            } else {
                // Create new group with unique inviteCode
                const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                const joinRequests = [];
                if (grp.privacy === 'private') {
                    joinRequests.push(
                        { user: createdUsers[5]._id, status: 'pending', createdAt: timeAgo(12) },
                        { user: createdUsers[15]._id, status: 'pending', createdAt: timeAgo(6) }
                    );
                }

                groupDoc = new Group({
                    name: grp.name,
                    privacy: grp.privacy,
                    avatar: grp.avatar,
                    admins: [adminUser._id],
                    members: memberUsers,
                    inviteCode,
                    joinRequests,
                    createdAt: timeAgo(72)
                });
                await groupDoc.save();
            }

            createdGroups.push(groupDoc);
        }
        console.log(`✅ ${createdGroups.length} groups verified & synced without duplicates!`);

        // 3. Idempotent Direct Messages (1-on-1 Chats)
        console.log('💬 Syncing realistic direct conversations (1-on-1 chats)...');

        let directMessageCount = 0;
        for (const convo of directConversations) {
            const user1 = createdUsers[convo.user1Idx];
            const user2 = createdUsers[convo.user2Idx];

            let prevMessageId = null;

            for (const msg of convo.messages) {
                const senderDoc = msg.sender === 0 ? user1 : user2;
                const recipientDoc = msg.sender === 0 ? user2 : user1;

                // Check if identical message already exists
                let messageDoc = await Message.findOne({
                    sender: senderDoc._id,
                    recipient: recipientDoc._id,
                    chatType: 'private',
                    content: msg.text
                });

                if (!messageDoc) {
                    const reactions = msg.reaction ? [{
                        user: recipientDoc._id,
                        reaction: msg.reaction,
                        createdAt: new Date(msg.time.getTime() + 60000)
                    }] : [];

                    const readBy = [{
                        user: recipientDoc._id,
                        readAt: new Date(msg.time.getTime() + 120000)
                    }];

                    messageDoc = new Message({
                        sender: senderDoc._id,
                        recipient: recipientDoc._id,
                        chatType: 'private',
                        content: msg.text,
                        readBy,
                        reactions,
                        replyTo: prevMessageId,
                        createdAt: msg.time,
                        updatedAt: msg.time
                    });

                    await messageDoc.save();
                }

                prevMessageId = messageDoc._id;
                directMessageCount++;
            }
        }
        console.log(`✅ ${directMessageCount} direct messages synced (0 duplicates)!`);

        // 4. Idempotent Group Messages with Pins, Threads, & Reactions
        console.log('👥 Syncing realistic group discussions and threads...');

        let groupMessageCount = 0;
        for (const disc of groupDiscussions) {
            const grp = createdGroups[disc.groupIndex];
            let prevGroupMsgId = null;

            for (const item of disc.threads) {
                const senderDoc = createdUsers[item.senderIdx];

                // Check if group message already exists
                let groupMsgDoc = await Message.findOne({
                    sender: senderDoc._id,
                    group: grp._id,
                    chatType: 'group',
                    content: item.text
                });

                if (!groupMsgDoc) {
                    const readBy = grp.members.slice(0, 8).map(mId => ({
                        user: mId,
                        readAt: new Date(item.time.getTime() + 180000)
                    }));

                    const reactions = item.reaction ? [{
                        user: grp.admins[0],
                        reaction: item.reaction,
                        createdAt: new Date(item.time.getTime() + 60000)
                    }] : [];

                    groupMsgDoc = new Message({
                        sender: senderDoc._id,
                        group: grp._id,
                        chatType: 'group',
                        content: item.text,
                        readBy,
                        reactions,
                        isPinned: item.isPinned || false,
                        pinnedBy: item.isPinned ? grp.admins[0] : undefined,
                        pinnedAt: item.isPinned ? item.time : undefined,
                        replyTo: prevGroupMsgId,
                        createdAt: item.time,
                        updatedAt: item.time
                    });

                    await groupMsgDoc.save();
                }

                prevGroupMsgId = groupMsgDoc._id;
                groupMessageCount++;
            }
        }
        console.log(`✅ ${groupMessageCount} group messages synced (0 duplicates)!`);

        console.log('\n========================================================');
        console.log('🎉 DATABASE SEEDING / SYNC COMPLETED SUCCESSFULLY!');
        console.log('========================================================');
        console.log(`👤 Total Users: ${createdUsers.length}`);
        console.log(`👥 Total Groups: ${createdGroups.length}`);
        console.log(`💬 Total Direct Messages: ${directMessageCount}`);
        console.log(`📢 Total Group Messages: ${groupMessageCount}`);
        console.log(`🔑 Login Password for ALL seeded users: "${DEFAULT_PASSWORD}"`);
        console.log('--------------------------------------------------------');
        console.log('🌟 Sample Accounts Ready to Log In:');
        console.log('  1. tanvir.hasan@example.com (Full Stack Lead)');
        console.log('  2. sultana.nisha@example.com (Product Designer UI/UX)');
        console.log('  3. arif.rahman@example.com   (DevOps Architect)');
        console.log('  4. mehnaz.c@example.com      (Engineering Manager)');
        console.log('  5. fahim.m@example.com       (Full Stack Dev & Gamer)');
        console.log('  6. priya.k@example.com       (AI & Data Scientist)');
        console.log('========================================================\n');

        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {
        console.error('❌ Database seeding failed:', error);
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
}

// Run if called directly from CLI
if (require.main === module) {
    seedDatabase();
}

module.exports = seedDatabase;
