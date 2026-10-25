//не удалять
// src/faceit_page.js — the public profile template.
//
// Layout and metrics are copied from the live page (measured at 1440x900 through
// CDP): rail 96, dock 64, content frame 96..viewport-64 with a 16px top radius,
// card column 316 at 104, main column 462..1336, season card 176 high, performance
// card 461 high. Type: Geist 400/700, nickname Coiny 28/32.
//
// The page renders whatever the profile record holds; blocks that need data the
// Data API does not return (match history, activity heat) are printed only when
// the record carries it.

import { esc } from './render_util.js';
import { icon } from './faceit_icons.js';

const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US') : '—');

// The arc is a fraction of the level: 7 -> 70%, 8 -> 80%, 10 -> full (sampled off
// live captures). The elo does not enter it; the earlier small arcs on level-10 pages
// were frames of the ring's load animation, not the resting state.
const LEVEL_COLORS = [
  '#EEEEEE', '#1CE400', '#1CE400', '#FFC700', '#FFC700',
  '#FFC700', '#FFC700', '#FF4B00', '#FF4B00', '#EF0000',
];
const level_color = (lv) => LEVEL_COLORS[lv - 1] ?? '#EF0000';
const SKILL_ARC = 'M 6.5, 18.4 A 8.4, 8.4 0 1 1 17.5, 18.4';
const SKILL_GLYPHS = {
  1: { t: 'matrix(1.026794 0 0 0.9086 -0.503212 0.771038)', d: 'M11.625 15V10.5262L10.5 10.9971V9.80233L12.1047 9H13.1424V15H11.625Z' },
  2: { t: 'matrix(0.881606 0 0 0.9226 1.383817 0.561249)', d: 'M9.83 15V14.181C9.83 13.8534 9.83862 13.5718 9.85586 13.3362C9.8731 13.1006 9.91046 12.8994 9.96793 12.7328C10.0311 12.5661 10.1289 12.4253 10.261 12.3103C10.3932 12.1897 10.5743 12.0805 10.8041 11.9828L12.1145 11.4569C12.2811 11.3879 12.4047 11.3276 12.4852 11.2759C12.5656 11.2184 12.6174 11.1494 12.6403 11.069C12.6633 10.9885 12.6748 10.8764 12.6748 10.7328C12.6748 10.5546 12.6461 10.4253 12.5886 10.3448C12.5311 10.2586 12.4277 10.2069 12.2783 10.1897C12.1289 10.1667 11.9191 10.1552 11.649 10.1552C11.5225 10.1552 11.3645 10.1609 11.1748 10.1724C10.9909 10.1839 10.7926 10.1983 10.58 10.2155C10.3674 10.2328 10.1576 10.2529 9.95069 10.2759V9.18966C10.1403 9.15517 10.3559 9.12356 10.5972 9.09483C10.8386 9.06609 11.0857 9.0431 11.3386 9.02586C11.5972 9.00862 11.8357 9 12.0541 9C12.3415 9 12.6116 9.02011 12.8645 9.06035C13.1231 9.09483 13.3501 9.16667 13.5455 9.27586C13.7409 9.38506 13.8932 9.54885 14.0024 9.76724C14.1174 9.98563 14.1748 10.2787 14.1748 10.6466C14.1748 11.0144 14.1346 11.3103 14.0541 11.5345C13.9794 11.7586 13.8674 11.9368 13.7179 12.069C13.5685 12.2011 13.3875 12.3103 13.1748 12.3966L11.6921 12.9741C11.5771 13.0201 11.488 13.069 11.4248 13.1207C11.3674 13.1667 11.3271 13.2299 11.3041 13.3103C11.2811 13.3851 11.2697 13.4856 11.2697 13.6121V13.8362H14.1748V15H9.83Z' },
  3: { t: 'matrix(0.895103 0 0 0.9366 1.123928 0.435248)', d: 'M11.7535 15C11.5603 15 11.3501 14.9915 11.1228 14.9744C10.8956 14.9631 10.6711 14.9432 10.4495 14.9148C10.2336 14.8807 10.0405 14.8494 9.87 14.821V13.7557C10.0745 13.7727 10.2848 13.7898 10.5007 13.8068C10.7166 13.8239 10.9211 13.8381 11.1143 13.8494C11.3132 13.8551 11.4808 13.858 11.6172 13.858C11.8728 13.858 12.0745 13.8494 12.2223 13.8324C12.3757 13.8097 12.4836 13.7528 12.5461 13.6619C12.6143 13.571 12.6484 13.4233 12.6484 13.2188C12.6484 13.0256 12.6257 12.8807 12.5802 12.7841C12.5348 12.6818 12.4552 12.6136 12.3416 12.5795C12.228 12.5455 12.0689 12.5284 11.8643 12.5284H10.8842V11.4034H11.8643C12.0461 11.4034 12.1882 11.3892 12.2905 11.3608C12.3984 11.3267 12.4751 11.267 12.5206 11.1818C12.5717 11.0909 12.5973 10.9545 12.5973 10.7727C12.5973 10.5682 12.5689 10.4233 12.512 10.3381C12.4552 10.2472 12.3501 10.1932 12.1967 10.1761C12.0433 10.1534 11.8217 10.142 11.5319 10.142C11.3672 10.142 11.1853 10.1477 10.9865 10.1591C10.7933 10.1705 10.6001 10.1847 10.4069 10.2017C10.2194 10.2131 10.0518 10.2301 9.90409 10.2528V9.17898C10.0689 9.14489 10.2592 9.11364 10.4751 9.08523C10.6967 9.05682 10.9183 9.03693 11.1399 9.02557C11.3672 9.00852 11.5745 9 11.762 9C12.2109 9 12.5831 9.03409 12.8785 9.10227C13.1797 9.17045 13.4183 9.26989 13.5944 9.40057C13.7706 9.53125 13.8956 9.69318 13.9694 9.88636C14.049 10.0739 14.0887 10.2926 14.0887 10.5426C14.0887 10.9688 14.0035 11.2869 13.8331 11.4972C13.6626 11.7074 13.4098 11.8494 13.0745 11.9233V11.9574C13.3018 12.0085 13.495 12.0824 13.6541 12.179C13.8132 12.2756 13.9325 12.4176 14.012 12.6051C14.0973 12.7926 14.1399 13.0455 14.1399 13.3636C14.1399 13.608 14.1058 13.8324 14.0376 14.0369C13.9751 14.2358 13.8586 14.4091 13.6882 14.5568C13.5177 14.6989 13.2762 14.8097 12.9638 14.8892C12.6513 14.9631 12.2478 15 11.7535 15Z' },
  4: { t: 'matrix(0.826548 0 0 0.9086 1.971934 0.771038)', d: 'M12.3105 15V13.7965H9.45V12.7587L11.5081 9H13.1477L11.0372 12.6279H12.3541L12.7901 11.1802H13.8105V12.6279H14.5517V13.7965H13.8105V15H12.3105Z' },
  5: { t: 'matrix(0.856234 0 0 0.9226 1.659005 0.645038)', d: 'M11.7524 15C11.5628 15 11.353 14.9914 11.1231 14.9741C10.8932 14.9626 10.6662 14.9454 10.4421 14.9224C10.2179 14.8937 10.0139 14.8592 9.83 14.819V13.75C10.0311 13.7672 10.238 13.7845 10.4507 13.8017C10.6691 13.8132 10.876 13.8247 11.0714 13.8362C11.2668 13.842 11.4363 13.8448 11.58 13.8448C11.8099 13.8448 11.9938 13.8362 12.1317 13.819C12.2697 13.796 12.376 13.7586 12.4507 13.7069C12.5311 13.6552 12.5857 13.5805 12.6145 13.4828C12.6432 13.3793 12.6576 13.25 12.6576 13.0948C12.6576 12.9282 12.6403 12.796 12.6059 12.6983C12.5771 12.5948 12.5225 12.5201 12.4421 12.4741C12.3616 12.4224 12.2495 12.3879 12.1059 12.3707C11.9622 12.3534 11.7783 12.3448 11.5541 12.3448C11.4047 12.3448 11.2323 12.3506 11.0369 12.3621C10.8415 12.3678 10.6461 12.3793 10.4507 12.3966C10.2553 12.408 10.0714 12.4224 9.89897 12.4397V9H13.7266V10.1638H11.2093V11.2759C11.307 11.2644 11.4191 11.2529 11.5455 11.2414C11.6777 11.2299 11.8099 11.2213 11.9421 11.2155C12.0743 11.2098 12.1949 11.2069 12.3041 11.2069C12.6777 11.2069 12.9852 11.2471 13.2266 11.3276C13.4679 11.408 13.6576 11.5259 13.7955 11.681C13.9334 11.8305 14.0283 12.0144 14.08 12.2328C14.1375 12.4511 14.1662 12.704 14.1662 12.9914C14.1662 13.342 14.1317 13.6437 14.0628 13.8966C13.9938 14.1494 13.8702 14.3592 13.6921 14.5259C13.5197 14.6868 13.2754 14.8075 12.9593 14.8879C12.649 14.9626 12.2467 15 11.7524 15Z' },
  6: { t: 'matrix(0.830162 0 0 0.9366 2.040408 0.435248)', d: 'M12.0831 15C11.6797 15 11.3359 14.9801 11.0518 14.9403C10.7677 14.9006 10.5291 14.821 10.3359 14.7017C10.1484 14.5824 9.995 14.4006 9.87568 14.1562C9.81886 14.0256 9.77057 13.8636 9.73079 13.6705C9.69102 13.4716 9.66261 13.2358 9.64557 12.9631C9.62852 12.6847 9.62 12.3693 9.62 12.017C9.62 11.7216 9.62568 11.4545 9.63705 11.2159C9.65409 10.9716 9.67966 10.7528 9.71375 10.5597C9.75352 10.3608 9.80466 10.1875 9.86716 10.0398C9.96943 9.77273 10.1143 9.56534 10.3018 9.41761C10.495 9.26989 10.7422 9.16477 11.0433 9.10227C11.3444 9.03409 11.7109 9 12.1427 9C12.3075 9 12.495 9.00852 12.7052 9.02557C12.9211 9.04261 13.1456 9.06534 13.3785 9.09375C13.6115 9.11648 13.8302 9.14773 14.0348 9.1875V10.2528C13.8302 10.2301 13.6228 10.2102 13.4126 10.1932C13.2081 10.1761 13.0206 10.1648 12.8501 10.1591C12.6797 10.1477 12.5376 10.142 12.424 10.142C12.1285 10.142 11.8927 10.1619 11.7166 10.2017C11.5405 10.2358 11.4069 10.3068 11.316 10.4148C11.2308 10.517 11.174 10.6676 11.1456 10.8665C11.1172 11.0653 11.103 11.3295 11.103 11.6591H11.1541C11.1995 11.608 11.2677 11.5511 11.3586 11.4886C11.4495 11.4261 11.5831 11.3722 11.7592 11.3267C11.941 11.2756 12.1797 11.25 12.4751 11.25C12.7876 11.25 13.0632 11.2727 13.3018 11.3182C13.5405 11.3636 13.7393 11.4489 13.8984 11.5739C14.0575 11.6932 14.1768 11.8665 14.2564 12.0938C14.3359 12.321 14.3757 12.6165 14.3757 12.9801C14.3757 13.3438 14.3444 13.6563 14.2819 13.9176C14.2194 14.1733 14.103 14.3807 13.9325 14.5398C13.7677 14.6989 13.5376 14.8153 13.2422 14.8892C12.9467 14.9631 12.5603 15 12.0831 15ZM12.0149 13.875C12.2081 13.875 12.3643 13.8693 12.4836 13.858C12.6086 13.8409 12.7052 13.8097 12.7734 13.7642C12.8416 13.7131 12.8899 13.6392 12.9183 13.5426C12.9467 13.4403 12.9609 13.3068 12.9609 13.142C12.9609 12.9659 12.9467 12.8267 12.9183 12.7244C12.8899 12.6165 12.8416 12.5398 12.7734 12.4943C12.7109 12.4432 12.6172 12.4119 12.4922 12.4006C12.3672 12.3835 12.2081 12.375 12.0149 12.375C11.8103 12.375 11.6484 12.3864 11.5291 12.4091C11.4098 12.4318 11.3189 12.4716 11.2564 12.5284C11.1995 12.5795 11.1626 12.6477 11.1456 12.733C11.1285 12.8125 11.12 12.9119 11.12 13.0313C11.12 13.2358 11.1342 13.3949 11.1626 13.5085C11.1967 13.6222 11.2478 13.7074 11.316 13.7642C11.3842 13.8153 11.4751 13.8466 11.5888 13.858C11.7024 13.8693 11.8444 13.875 12.0149 13.875Z' },
  7: { t: 'matrix(0.911503 0 0 0.9086 0.967267 0.771038)', d: 'M10.3843 15L12.5907 10.1773H9.8V9H14.1866V10.0727L12.05 15H10.3843Z' },
  8: { t: 'matrix(0.83328 0 0 0.9366 2.000248 0.435248)', d: 'M12 15C11.4872 15 11.0647 14.9631 10.7325 14.8892C10.4062 14.8153 10.1527 14.7074 9.97203 14.5653C9.7972 14.4233 9.67483 14.2528 9.6049 14.054C9.53497 13.8494 9.5 13.6193 9.5 13.3636C9.5 13.0398 9.54079 12.7869 9.62238 12.6051C9.70979 12.4176 9.83508 12.2756 9.99825 12.179C10.1614 12.0824 10.3596 12.0085 10.5927 11.9574V11.9233C10.243 11.8494 9.98077 11.7074 9.80594 11.4972C9.63695 11.2869 9.55245 10.9687 9.55245 10.5426C9.55245 10.2926 9.59033 10.071 9.66609 9.87784C9.74767 9.68466 9.87879 9.52273 10.0594 9.39205C10.2459 9.26136 10.4965 9.16477 10.8112 9.10227C11.1317 9.03409 11.528 9 12 9C12.472 9 12.8654 9.03409 13.1801 9.10227C13.5006 9.16477 13.7512 9.26136 13.9318 9.39205C14.1183 9.52273 14.2494 9.68466 14.3252 9.87784C14.4068 10.071 14.4476 10.2926 14.4476 10.5426C14.4476 10.9687 14.3601 11.2869 14.1853 11.4972C14.0163 11.7074 13.757 11.8494 13.4073 11.9233V11.9574C13.6463 12.0085 13.8444 12.0824 14.0017 12.179C14.1649 12.2756 14.2873 12.4176 14.3689 12.6051C14.4563 12.7869 14.5 13.0398 14.5 13.3636C14.5 13.6193 14.465 13.8494 14.3951 14.054C14.3252 14.2528 14.1999 14.4233 14.0192 14.5653C13.8386 14.7074 13.5851 14.8153 13.2587 14.8892C12.9324 14.9631 12.5128 15 12 15ZM12 13.892C12.2622 13.892 12.4633 13.8807 12.6031 13.858C12.743 13.8295 12.8392 13.767 12.8916 13.6705C12.9499 13.5682 12.979 13.4119 12.979 13.2017C12.979 13.0426 12.9645 12.9148 12.9353 12.8182C12.912 12.7216 12.8625 12.6506 12.7867 12.6051C12.7168 12.554 12.6177 12.5199 12.4895 12.5028C12.3613 12.4858 12.1981 12.4773 12 12.4773C11.8019 12.4773 11.6387 12.4858 11.5105 12.5028C11.3823 12.5199 11.2832 12.554 11.2133 12.6051C11.1434 12.6506 11.0938 12.7216 11.0647 12.8182C11.0414 12.9148 11.0297 13.0426 11.0297 13.2017C11.0297 13.4119 11.0559 13.5682 11.1084 13.6705C11.1608 13.767 11.257 13.8295 11.3969 13.858C11.5425 13.8807 11.7436 13.892 12 13.892ZM12 11.4545C12.2681 11.4545 12.4662 11.4403 12.5944 11.4119C12.7284 11.3835 12.8158 11.321 12.8566 11.2244C12.9033 11.1278 12.9266 10.983 12.9266 10.7898C12.9266 10.5852 12.9033 10.4375 12.8566 10.3466C12.8158 10.25 12.7284 10.1875 12.5944 10.1591C12.4662 10.125 12.2681 10.108 12 10.108C11.7378 10.108 11.5396 10.125 11.4056 10.1591C11.2716 10.1875 11.1842 10.25 11.1434 10.3466C11.1026 10.4375 11.0822 10.5852 11.0822 10.7898C11.0822 10.983 11.1026 11.1278 11.1434 11.2244C11.1842 11.321 11.2716 11.3835 11.4056 11.4119C11.5396 11.4403 11.7378 11.4545 12 11.4545Z' },
  9: { t: 'matrix(0.831928 0 0 0.9366 2.023415 0.435248)', d: 'M11.853 15C11.6882 15 11.495 14.9915 11.2734 14.9744C11.0575 14.9574 10.8331 14.9347 10.6001 14.9062C10.3728 14.8778 10.1598 14.8466 9.96091 14.8125V13.7472C10.1768 13.7699 10.3842 13.7898 10.5831 13.8068C10.7876 13.8239 10.978 13.8381 11.1541 13.8494C11.3302 13.8551 11.4694 13.858 11.5717 13.858C11.8728 13.858 12.1086 13.8409 12.2791 13.8068C12.4552 13.767 12.5859 13.696 12.6711 13.5938C12.762 13.4858 12.8217 13.3324 12.8501 13.1335C12.8842 12.9347 12.9012 12.6705 12.9012 12.3409H12.8501C12.8047 12.392 12.7336 12.4489 12.637 12.5114C12.5461 12.5739 12.4126 12.6307 12.2365 12.6818C12.0603 12.7273 11.8245 12.75 11.5291 12.75C11.2109 12.75 10.9325 12.7273 10.6939 12.6818C10.4609 12.6364 10.2649 12.554 10.1058 12.4347C9.9467 12.3097 9.82454 12.1335 9.73932 11.9063C9.65977 11.679 9.62 11.3835 9.62 11.0199C9.62 10.6563 9.65125 10.3466 9.71375 10.0909C9.78193 9.82955 9.89841 9.61932 10.0632 9.46023C10.228 9.30114 10.4581 9.18466 10.7535 9.1108C11.0547 9.03693 11.441 9 11.9126 9C12.3615 9 12.7365 9.02557 13.0376 9.0767C13.3388 9.12216 13.5802 9.21591 13.762 9.35795C13.9495 9.49432 14.0888 9.70455 14.1797 9.98864C14.2535 10.2216 14.3047 10.5 14.3331 10.8239C14.3615 11.1477 14.3757 11.5341 14.3757 11.983C14.3757 12.3182 14.3643 12.6193 14.3416 12.8864C14.3245 13.1534 14.2933 13.3892 14.2478 13.5938C14.2024 13.7983 14.1399 13.9773 14.0603 14.1307C13.9467 14.3466 13.7933 14.5199 13.6001 14.6506C13.4069 14.7756 13.1683 14.8665 12.8842 14.9233C12.6001 14.9744 12.2564 15 11.853 15ZM11.9808 11.625C12.1853 11.625 12.3473 11.6136 12.4666 11.5909C12.5916 11.5682 12.6825 11.5312 12.7393 11.4801C12.7961 11.4233 12.8331 11.3551 12.8501 11.2756C12.8672 11.1903 12.8757 11.0881 12.8757 10.9687C12.8757 10.7642 12.8586 10.6051 12.8245 10.4915C12.7961 10.3778 12.7478 10.2955 12.6797 10.2443C12.6115 10.1875 12.5206 10.1534 12.4069 10.142C12.2933 10.1307 12.1512 10.125 11.9808 10.125C11.7933 10.125 11.637 10.1335 11.512 10.1506C11.387 10.1619 11.2905 10.1932 11.2223 10.2443C11.1541 10.2898 11.1058 10.3636 11.0774 10.4659C11.0547 10.5625 11.0433 10.6932 11.0433 10.858C11.0433 11.0341 11.0547 11.1761 11.0774 11.2841C11.1058 11.3864 11.1541 11.4631 11.2223 11.5142C11.2905 11.5597 11.3842 11.5909 11.5035 11.608C11.6285 11.6193 11.7876 11.625 11.9808 11.625Z' },
  10: { t: 'matrix(1.012282 0 0 0.9366 -0.352162 0.435248)', d: 'M13.7515 15C13.3348 15 12.9884 14.9773 12.7124 14.9318C12.4365 14.8807 12.2173 14.7926 12.0549 14.6676C11.8926 14.5426 11.7708 14.3693 11.6897 14.1477C11.6139 13.9205 11.5652 13.6307 11.5435 13.2784C11.5219 12.9261 11.5111 12.5 11.5111 12C11.5111 11.5 11.5219 11.0739 11.5435 10.7216C11.5652 10.3693 11.6139 10.0824 11.6897 9.8608C11.7708 9.63352 11.8926 9.45739 12.0549 9.33239C12.2173 9.20739 12.4365 9.12216 12.7124 9.0767C12.9884 9.02557 13.3348 9 13.7515 9C14.1736 9 14.5199 9.02557 14.7905 9.0767C15.0665 9.12216 15.2857 9.20739 15.448 9.33239C15.6104 9.45739 15.7294 9.63352 15.8052 9.8608C15.8864 10.0824 15.9378 10.3693 15.9594 10.7216C15.9865 11.0739 16 11.5 16 12C16 12.5 15.9865 12.9261 15.9594 13.2784C15.9378 13.6307 15.8864 13.9205 15.8052 14.1477C15.7294 14.3693 15.6104 14.5426 15.448 14.6676C15.2857 14.7926 15.0665 14.8807 14.7905 14.9318C14.5199 14.9773 14.1736 15 13.7515 15ZM13.7515 13.858C13.9138 13.858 14.0464 13.8523 14.1492 13.8409C14.2521 13.8239 14.3332 13.7869 14.3928 13.7301C14.4523 13.6733 14.4956 13.5795 14.5226 13.4489C14.5497 13.3125 14.5659 13.1278 14.5713 12.8949C14.5822 12.6619 14.5876 12.3636 14.5876 12C14.5876 11.6364 14.5822 11.3381 14.5713 11.1051C14.5659 10.8722 14.5497 10.6903 14.5226 10.5597C14.4956 10.4233 14.4523 10.3267 14.3928 10.2699C14.3332 10.2131 14.2521 10.179 14.1492 10.1676C14.0518 10.1506 13.9192 10.142 13.7515 10.142C13.5945 10.142 13.462 10.1506 13.3537 10.1676C13.2509 10.179 13.1697 10.2131 13.1102 10.2699C13.0561 10.3267 13.0155 10.4233 12.9884 10.5597C12.9614 10.6903 12.9424 10.8722 12.9316 11.1051C12.9262 11.3381 12.9235 11.6364 12.9235 12C12.9235 12.3636 12.9262 12.6619 12.9316 12.8949C12.9424 13.1278 12.9614 13.3125 12.9884 13.4489C13.0155 13.5795 13.0561 13.6733 13.1102 13.7301C13.1697 13.7869 13.2509 13.8239 13.3537 13.8409C13.4565 13.8523 13.5891 13.858 13.7515 13.858Z M9.04715 14.9318V10.5597L8 11.0199V9.85228L9.49361 9.06819H10.4596V14.9318H9.04715Z' },
  q: { t: '', d: 'M10.9551 13V12.4138C10.9551 12.1897 10.9803 12.0115 11.0307 11.8793C11.0812 11.7471 11.1537 11.6466 11.2482 11.5776C11.3491 11.5086 11.472 11.4511 11.617 11.4052L11.9291 11.3103C12.0615 11.2701 12.1592 11.2328 12.2222 11.1983C12.2916 11.158 12.3357 11.1006 12.3546 11.0259C12.3798 10.9454 12.3924 10.8305 12.3924 10.681C12.3924 10.5086 12.3641 10.3851 12.3073 10.3103C12.2506 10.2356 12.156 10.1925 12.0236 10.181C11.8976 10.1638 11.7179 10.1552 11.4846 10.1552C11.3901 10.1552 11.2766 10.158 11.1442 10.1638C11.0181 10.1695 10.8826 10.1782 10.7376 10.1897C10.5989 10.1954 10.4634 10.204 10.331 10.2155C10.2049 10.2213 10.0946 10.2299 10 10.2414V9.15517C10.1765 9.12644 10.3783 9.10057 10.6052 9.07759C10.8322 9.04885 11.0623 9.02874 11.2955 9.01724C11.5351 9.00575 11.7557 9 11.9574 9C12.279 9 12.5658 9.02299 12.818 9.06897C13.0701 9.11494 13.2845 9.19828 13.461 9.31897C13.6375 9.43391 13.7699 9.5977 13.8582 9.81034C13.9527 10.0172 14 10.2874 14 10.6207C14 10.8563 13.9779 11.0546 13.9338 11.2155C13.8897 11.3764 13.8266 11.5086 13.7447 11.6121C13.6627 11.7098 13.565 11.7902 13.4515 11.8534C13.3381 11.9167 13.2151 11.9713 13.0827 12.0172L12.7707 12.1121C12.6635 12.1408 12.5784 12.1695 12.5154 12.1983C12.4523 12.2213 12.405 12.2529 12.3735 12.2931C12.3483 12.3276 12.3294 12.3793 12.3168 12.4483C12.3105 12.5172 12.3073 12.6121 12.3073 12.7328V13H10.9551ZM10.8322 15V13.75H12.4492V15H10.8322Z' },
};

let skill_uid = 0;
export function skill_badge(level, size = 64, elo = null) {
  const lv = Math.max(0, Math.min(10, Math.floor(Number(level) || 0)));
  // Unranked (no level yet): the live badge shows the grey calibration ring instead
  // of a progress arc, with the "?" glyph and the word Unranked next to it.
  const unranked = lv === 0;
  const fill = unranked ? null : lv / 10;
  const uid = `sk${++skill_uid}`;
  const glyph = SKILL_GLYPHS[lv] ?? SKILL_GLYPHS.q;
  const tf = glyph.t ? ` transform="${glyph.t}"` : '';
  const progress = fill === null
    ? `<path d="${SKILL_ARC}" fill="none" stroke="url(#${uid}-cal)" stroke-width="2.4"></path>`
    : `
      <path d="${SKILL_ARC}" fill="none" stroke="${level_color(lv)}" stroke-width="2.4" pathLength="10"
            stroke-dasharray="10.1 10000" stroke-dashoffset="${(10.1 - fill * 10).toFixed(2)}"></path>`;
  return `<svg class="skill" viewBox="0 0 24 24" width="${size}" height="${size}" role="img" aria-label="Skill level ${lv || '?'}">
      <title>Skill level ${lv || '?'}</title>
      <defs>
        <radialGradient id="${uid}-bg" cx="0.5" cy="0.5" r="0.55">
          <stop offset="0.4" stop-color="#5D5D5D"></stop><stop offset="1" stop-color="#242424"></stop>
        </radialGradient>
        <linearGradient id="${uid}-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.5" stop-color="#F1F1F1"></stop><stop offset="1" stop-color="#383838"></stop>
        </linearGradient>
        <radialGradient id="${uid}-cal" cx="0" cy="0.9" r="2">
          <stop offset="0.0865385" stop-color="#2A2A2A"></stop><stop offset="0.384615" stop-color="#4A4A4A"></stop><stop offset="0.711538" stop-color="#8D8D8D"></stop><stop offset="1" stop-color="#A6A6A6"></stop>
        </radialGradient>
      </defs>
      <circle r="50%" cx="50%" cy="50%" fill="#060606"></circle>
      <path d="${SKILL_ARC}" fill="none" stroke="url(#${uid}-bg)" stroke-width="2.4"></path>${progress}
      <path${tf} d="${glyph.d}" fill="url(#${uid}-fill)"></path>
    </svg>`;
}

// The avatar level badge, 1:1 from the live profile DOM (level-10 capture): metallic
// octagon plate — #060606 body, bevel gradients #E2F5FF/#80B3CC/#0B5588, soft #B5D1E4
// glow — with a star mark. Levels 1-9 and the unknown state have not been captured;
// until one is, they render the same plate with the digit glyph in the same metallic
// gradient.
function level_plate(level) {
  const lv = Math.max(0, Math.min(10, Math.floor(Number(level) || 0)));
  const uid = `pl${++skill_uid}`;
  const F = `url(#${uid}`;
  const plate = 'M46.8802 12.8631C46.2683 12.309 45.4708 12.0001 44.6414 12H19.3586C18.474 12.0001 17.6253 12.3518 16.9998 12.9773L12.9773 16.9998C12.3518 17.6253 12.0001 18.474 12 19.3586V44.6414C12.0001 45.5261 12.3518 46.3747 12.9773 47.0002L16.9998 51.0227C17.6253 51.6482 18.474 51.9999 19.3586 52H44.6414C45.5261 51.9999 46.3747 51.6482 47.0002 51.0227L51.0227 47.0002C51.6482 46.3747 51.9999 45.5261 52 44.6414V19.3586C51.9999 18.474 51.6482 17.6253 51.0227 16.9998L47.0002 12.9773L46.8802 12.8631Z';
  const inset = 'M13.667 19.3559C13.667 18.9138 13.8426 18.4898 14.1552 18.1773L18.1792 14.1532C18.4918 13.8406 18.9158 13.665 19.3579 13.665H44.6461C45.0882 13.665 45.5121 13.8406 45.8247 14.1532L49.8488 18.1773C50.1614 18.4898 50.337 18.9138 50.337 19.3559V44.6441C50.337 45.0862 50.1614 45.5102 49.8488 45.8227L45.8247 49.8468C45.5121 50.1594 45.0882 50.335 44.6461 50.335H19.3579C18.9158 50.335 18.4918 50.1594 18.1792 49.8468L14.1552 45.8227C13.8426 45.5102 13.667 45.0862 13.667 44.6441V19.3559Z';
  const bevel = 'M44.6465 49.085V50.335H19.3574V49.085H44.6465ZM49.087 44.6446V19.3554C49.0869 19.2451 49.0429 19.1395 48.9649 19.0615L44.9405 15.0371C44.8624 14.9591 44.7569 14.9151 44.6465 14.915H19.3574C19.2471 14.9151 19.1415 14.9591 19.0635 15.0371L15.0391 19.0615C14.9611 19.1395 14.9171 19.2451 14.917 19.3554V44.6446C14.9171 44.7549 14.9611 44.8604 15.0391 44.9385L19.0635 48.9629C19.1415 49.0409 19.2471 49.0849 19.3574 49.085V50.335C18.9709 50.3349 18.5982 50.2008 18.3018 49.958L18.1797 49.8467L14.1553 45.8233C13.8817 45.5497 13.7126 45.1903 13.6748 44.8086L13.667 44.6446V19.3554C13.6671 18.9688 13.802 18.5963 14.0449 18.2998L14.1553 18.1777L18.1797 14.1533C18.4922 13.8409 18.9156 13.6651 19.3574 13.665H44.6465L44.8106 13.6728C45.1923 13.7106 45.5517 13.8797 45.8253 14.1533L49.8487 18.1777C50.1611 18.4902 50.3369 18.9136 50.337 19.3554V44.6446L50.3292 44.8086C50.2914 45.1903 50.1223 45.5497 49.8487 45.8233L45.8253 49.8467L45.7022 49.958C45.448 50.1662 45.1376 50.2948 44.8106 50.3272L44.6465 50.335V49.085C44.7569 49.0849 44.8624 49.0409 44.9405 48.9629L48.9649 44.9385C49.0429 44.8604 49.0869 44.7549 49.087 44.6446Z';
  const inner = 'M17.8369 20.3933V43.6067L20.3952 46.165H43.6086L46.1669 43.6067V20.3933L43.6086 17.835H20.3952L17.8369 20.3933Z';
  const face = 'M43.6083 17.835L46.1669 20.3936V43.6064L43.6083 46.165H20.3955L17.8369 43.6064V20.3936L20.3955 17.835H43.6083ZM19.0869 20.9112V43.0888L20.9131 44.915H43.0908L44.9169 43.0888V20.9112L43.0908 19.085H20.9131L19.0869 20.9112Z';
  const star = 'M32 19.08C32.5517 19.08 33.0384 19.4422 33.1973 19.9706L35.5059 27.6513H43.165C43.7023 27.6513 44.1799 27.9944 44.3506 28.5038C44.5213 29.0133 44.3467 29.5746 43.918 29.8984L37.7412 34.5624L40.0674 42.2997C40.223 42.8175 40.0287 43.3776 39.585 43.6864C39.1412 43.9952 38.5486 43.9829 38.1172 43.6572L32 39.038L25.8828 43.6572C25.4502 43.9838 24.8561 43.9945 24.4121 43.6835C23.9682 43.3725 23.7755 42.811 23.9346 42.2929L26.0811 35.3007C26.1612 35.0397 26.3252 34.8126 26.5469 34.6532L27.4756 33.9853H25.9883C25.7195 33.9853 25.4578 33.8986 25.2422 33.7382L20.0889 29.9042C19.6565 29.5825 19.479 29.0193 19.6484 28.5077C19.818 27.9963 20.2962 27.6513 20.835 27.6513H28.4941L30.8027 19.9706C30.9616 19.4422 31.4482 19.08 32 19.08ZM29.4238 28.9013H20.835L25.9883 32.7353H31.3555L27.2764 35.6679L25.1289 42.6601L32 37.4726L38.8711 42.6601L36.2939 34.0888L43.165 28.9013H34.5762L32 20.33L29.4238 28.9013Z';
  const star_face = 'M43.165 28.9011L36.2942 34.0889L38.8707 42.66L32 37.4722L25.1292 42.66L27.2763 35.6678L31.3558 32.7356H25.988L20.835 28.9011H29.4234L32 20.33L34.5765 28.9011H43.165Z';
  const star_hi = 'M34.5761 28.9013H43.165L36.2939 34.0887L38.871 42.66L32 37.4725L25.1289 42.66L27.2763 35.6678L31.3554 32.7352H25.9883L20.835 28.9013H29.4238L32 20.33L34.5761 28.9013ZM30.3525 30.1513H24.6094L26.4023 31.4852H35.2363L28.3476 36.4354L27.458 39.3348L32 35.9061L36.5722 39.3583L34.8466 33.6151L39.4345 30.1513H33.6474L32 24.6708L30.3525 30.1513Z';
  const glyph = SKILL_GLYPHS[lv] ?? SKILL_GLYPHS.q;
  const mark = lv === 10
    ? `<path d="${star}" fill="#060606"></path><path d="${star_face}" fill="${F}-p4)"></path><path d="${star_hi}" fill="${F}-p5)"></path>`
    : `<g transform="translate(8 8) scale(2)"><path${glyph.t ? ` transform="${glyph.t}"` : ''} d="${glyph.d}" fill="${F}-p4)"></path></g>`;
  return `<svg class="pstar" viewBox="0 0 64 64" aria-hidden="true">
      <g opacity="0.35" filter="${F}-f)"><path d="${plate}" fill="#B5D1E4"/></g>
      <path d="${plate}" fill="#060606"></path>
      <path d="${inset}" fill="${F}-p0)"></path>
      <path d="${inset}" fill="${F}-p1)"></path>
      <path d="${bevel}" fill="${F}-p2)"></path>
      <path d="${inner}" fill="#222B3A"></path>
      <path d="${face}" fill="${F}-p3)"></path>
      ${mark}
      <defs>
        <filter id="${uid}-f" x="2" y="2" width="60" height="60" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="5"/></filter>
        <linearGradient id="${uid}-p0" x1="32.002" y1="13.665" x2="32.002" y2="50.335" gradientUnits="userSpaceOnUse"><stop stop-color="#E2F5FF"/><stop offset="0.5" stop-color="#80B3CC"/><stop offset="0.51" stop-color="#0B5588"/><stop offset="1" stop-color="#D3E2ED"/></linearGradient>
        <linearGradient id="${uid}-p1" x1="32.002" y1="13.665" x2="32.002" y2="50.335" gradientUnits="userSpaceOnUse"><stop stop-color="#E2F5FF" stop-opacity="0.4"/><stop offset="1" stop-color="#E2F5FF" stop-opacity="0.15"/></linearGradient>
        <linearGradient id="${uid}-p2" x1="32.0019" y1="17.835" x2="32.0019" y2="46.165" gradientUnits="userSpaceOnUse"><stop stop-color="#E2F5FF" stop-opacity="0"/><stop offset="1" stop-color="#E2F5FF" stop-opacity="0.4"/></linearGradient>
        <linearGradient id="${uid}-p3" x1="32.0019" y1="17.835" x2="32.0019" y2="46.165" gradientUnits="userSpaceOnUse"><stop stop-color="#030F15"/><stop offset="1" stop-color="#030F15" stop-opacity="0.3"/></linearGradient>
        <linearGradient id="${uid}-p4" x1="32" y1="20.33" x2="32" y2="42.66" gradientUnits="userSpaceOnUse"><stop stop-color="#E2F5FF"/><stop offset="1" stop-color="#80B3CC"/></linearGradient>
        <linearGradient id="${uid}-p5" x1="32" y1="20.33" x2="32" y2="42.66" gradientUnits="userSpaceOnUse"><stop stop-color="#E2F5FF" stop-opacity="0.4"/><stop offset="1" stop-color="#E2F5FF" stop-opacity="0"/></linearGradient>
      </defs>
    </svg>`;
}
const CHEV = '<svg class="chev" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>';
const GIFT = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.8 8.6h16.4v4H3.8z"/><path d="M5.4 12.6v7.6h13.2v-7.6"/><path d="M12 8.6v11.6"/><path d="M12 8.6C10.4 5.4 9 4 7.4 4 6 4 5 4.9 5 6.1c0 1.4 1.6 2.5 4 2.5z"/><path d="M12 8.6C13.6 5.4 15 4 16.6 4 18 4 19 4.9 19 6.1c0 1.4-1.6 2.5-4 2.5z"/></svg>';
const DOTS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M10 4h4v4h-4V4zm0 6h4v4h-4v-4zm4 6h-4v4h4v-4z"/></svg>';
const GLOBE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3C9.5 6 9.5 18 12 21"/></svg>';

const FLAGS = { rs: '🇷🇸', fr: '🇫🇷', de: '🇩🇪', us: '🇺🇸', ru: '🇷🇺', ua: '🇺🇦', pl: '🇵🇱', se: '🇸🇪', gb: '🇬🇧', br: '🇧🇷' };
// Flat flag drawings for the pills and the bio line — the live page uses flat SVG
// flags, not emoji. Shared clipPath id is fine: every instance is the same shape.
const rc = '<defs><clipPath id="rc16"><rect width="16" height="12" rx="2"/></clipPath></defs>';
const FLAG_SVGS = {
  de: `<svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">${rc}<g clip-path="url(#rc16)"><rect width="16" height="4" fill="#26262a"/><rect y="4" width="16" height="4" fill="#DD0000"/><rect y="8" width="16" height="4" fill="#FFCE00"/></g></svg>`,
  fr: `<svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">${rc}<g clip-path="url(#rc16)"><rect width="6" height="12" fill="#0055A4"/><rect x="6" width="5" height="12" fill="#F1F1F1"/><rect x="11" width="5" height="12" fill="#EF4135"/></g></svg>`,
  rs: `<svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">${rc}<g clip-path="url(#rc16)"><rect width="16" height="4" fill="#C6363C"/><rect y="4" width="16" height="4" fill="#0C4076"/><rect y="8" width="16" height="4" fill="#F1F1F1"/></g></svg>`,
};
const flag = (cc) => FLAG_SVGS[String(cc || '').toLowerCase()] ?? FLAGS[String(cc || '').toLowerCase()] ?? '🏳️';
const EU_FLAG = `<svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">${rc}<g clip-path="url(#rc16)"><rect width="16" height="12" fill="#4A88DC"/><g fill="#F1F1F1"><circle cx="11.2" cy="6" r=".8"/><circle cx="10.3" cy="8.3" r=".8"/><circle cx="8" cy="9.2" r=".8"/><circle cx="5.7" cy="8.3" r=".8"/><circle cx="4.8" cy="6" r=".8"/><circle cx="5.7" cy="3.7" r=".8"/><circle cx="8" cy="2.8" r=".8"/><circle cx="10.3" cy="3.7" r=".8"/></g></g></svg>`;
const REGION_ICONS = { EU: EU_FLAG };
const MEDAL = "<svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 80 80\" height=\"32\" width=\"32\"><mask id=\"a__lpXpXsZG\" width=\"68\" height=\"68\" x=\"6\" y=\"6\" maskUnits=\"userSpaceOnUse\"><circle cx=\"40\" cy=\"40\" r=\"34\" fill=\"#060606\"></circle></mask><g mask=\"url(#a__lpXpXsZG)\"><g filter=\"url(#b__lpXpXsZG)\"><circle cx=\"40.168\" cy=\"40.167\" r=\"27.5\" fill=\"url(#c__lpXpXsZG)\"></circle></g><g filter=\"url(#d__lpXpXsZG)\"><path fill=\"url(#e__lpXpXsZG)\" fill-rule=\"evenodd\" d=\"M40.001 6.667c18.41 0 33.333 14.923 33.333 33.333S58.41 73.333 40.001 73.333C21.591 73.333 6.668 58.41 6.668 40S21.592 6.667 40.001 6.667m0 6.666c-14.728 0-26.667 11.94-26.667 26.667s11.94 26.667 26.667 26.667S66.668 54.727 66.668 40s-11.94-26.667-26.667-26.667\" clip-rule=\"evenodd\"></path><path fill=\"url(#f__lpXpXsZG)\" fill-opacity=\".2\" fill-rule=\"evenodd\" d=\"M40.001 6.667c18.41 0 33.333 14.923 33.333 33.333S58.41 73.333 40.001 73.333C21.591 73.333 6.668 58.41 6.668 40S21.592 6.667 40.001 6.667m0 6.666c-14.728 0-26.667 11.94-26.667 26.667s11.94 26.667 26.667 26.667S66.668 54.727 66.668 40s-11.94-26.667-26.667-26.667\" clip-rule=\"evenodd\"></path><path fill=\"url(#g__lpXpXsZG)\" fill-opacity=\".3\" fill-rule=\"evenodd\" d=\"M40.001 6.667c18.41 0 33.333 14.923 33.333 33.333S58.41 73.333 40.001 73.333C21.591 73.333 6.668 58.41 6.668 40S21.592 6.667 40.001 6.667m0 6.666c-14.728 0-26.667 11.94-26.667 26.667s11.94 26.667 26.667 26.667S66.668 54.727 66.668 40s-11.94-26.667-26.667-26.667\" clip-rule=\"evenodd\"></path><path fill=\"url(#h__lpXpXsZG)\" d=\"M54.5 25.266c0-.268-.33-.335-.463-.134-4.233 6.633-6.68 10.384-8.797 13.868h-25.4c-.331 0-.464.402-.2.536 10.518 4.02 25.732 10.116 34.265 13.466.198.067.595-.134.595-.268z\"></path><path fill=\"url(#i__lpXpXsZG)\" fill-opacity=\".2\" d=\"M54.5 25.266c0-.268-.33-.335-.463-.134-4.233 6.633-6.68 10.384-8.797 13.868h-25.4c-.331 0-.464.402-.2.536 10.518 4.02 25.732 10.116 34.265 13.466.198.067.595-.134.595-.268z\"></path><path fill=\"url(#j__lpXpXsZG)\" fill-opacity=\".3\" d=\"M54.5 25.266c0-.268-.33-.335-.463-.134-4.233 6.633-6.68 10.384-8.797 13.868h-25.4c-.331 0-.464.402-.2.536 10.518 4.02 25.732 10.116 34.265 13.466.198.067.595-.134.595-.268z\"></path></g></g><defs><linearGradient id=\"c__lpXpXsZG\" x1=\"17.484\" x2=\"41.662\" y1=\"17.483\" y2=\"75.854\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#732600\"></stop><stop offset=\"1\" stop-color=\"#260d00\"></stop><stop offset=\"1\" stop-color=\"#401500\"></stop></linearGradient><linearGradient id=\"e__lpXpXsZG\" x1=\"38.501\" x2=\"38.501\" y1=\"28.436\" y2=\"51.784\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#fd6e35\"></stop><stop offset=\"1\" stop-color=\"#f50\"></stop></linearGradient><linearGradient id=\"f__lpXpXsZG\" x1=\"38.501\" x2=\"38.501\" y1=\"28.436\" y2=\"35.288\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#fff\"></stop><stop offset=\"1\" stop-color=\"#fff\" stop-opacity=\"0\"></stop></linearGradient><linearGradient id=\"g__lpXpXsZG\" x1=\"30.275\" x2=\"35.9\" y1=\"24.022\" y2=\"40.987\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"red\"></stop><stop offset=\"1\" stop-color=\"red\" stop-opacity=\"0\"></stop></linearGradient><linearGradient id=\"h__lpXpXsZG\" x1=\"38.501\" x2=\"38.501\" y1=\"28.436\" y2=\"51.784\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#fd6e35\"></stop><stop offset=\"1\" stop-color=\"#f50\"></stop></linearGradient><linearGradient id=\"i__lpXpXsZG\" x1=\"38.501\" x2=\"38.501\" y1=\"28.436\" y2=\"35.288\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#fff\"></stop><stop offset=\"1\" stop-color=\"#fff\" stop-opacity=\"0\"></stop></linearGradient><linearGradient id=\"j__lpXpXsZG\" x1=\"30.275\" x2=\"35.9\" y1=\"24.022\" y2=\"40.987\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"red\"></stop><stop offset=\"1\" stop-color=\"red\" stop-opacity=\"0\"></stop></linearGradient><filter id=\"b__lpXpXsZG\" width=\"55\" height=\"56\" x=\"12.668\" y=\"12.667\" color-interpolation-filters=\"sRGB\" filterUnits=\"userSpaceOnUse\"><feFlood flood-opacity=\"0\" result=\"BackgroundImageFix\"></feFlood><feBlend in=\"SourceGraphic\" in2=\"BackgroundImageFix\" result=\"shape\"></feBlend><feColorMatrix in=\"SourceAlpha\" result=\"hardAlpha\" values=\"0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0\"></feColorMatrix><feOffset dy=\"1\"></feOffset><feGaussianBlur stdDeviation=\"1.5\"></feGaussianBlur><feComposite in2=\"hardAlpha\" k2=\"-1\" k3=\"1\" operator=\"arithmetic\"></feComposite><feColorMatrix values=\"0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.46 0\"></feColorMatrix><feBlend in2=\"shape\" result=\"effect1_innerShadow_9709_57359\"></feBlend></filter><filter id=\"d__lpXpXsZG\" width=\"70.668\" height=\"70.666\" x=\"4.668\" y=\"4.677\" color-interpolation-filters=\"sRGB\" filterUnits=\"userSpaceOnUse\"><feFlood flood-opacity=\"0\" result=\"BackgroundImageFix\"></feFlood><feColorMatrix in=\"SourceAlpha\" result=\"hardAlpha\" values=\"0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0\"></feColorMatrix><feOffset dy=\".01\"></feOffset><feGaussianBlur stdDeviation=\"1\"></feGaussianBlur><feColorMatrix values=\"0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.64 0\"></feColorMatrix><feBlend in2=\"BackgroundImageFix\" result=\"effect1_dropShadow_9709_57359\"></feBlend><feBlend in=\"SourceGraphic\" in2=\"effect1_dropShadow_9709_57359\" result=\"shape\"></feBlend></filter></defs></svg>";
const AT_ICON = '<svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"><path fill="currentColor" d="M12.484 21.597C5.991 21.597 2 18.08 2 12.601 2 6.603 6.628 2.4 12.91 2.4c5.312 0 9.09 2.999 9.09 8.052 0 3.778-2.03 6.8-4.746 6.8-1.393 0-2.338-.684-2.48-1.629-.684.992-1.936 1.724-3.518 1.724-2.762 0-4.463-1.866-4.463-4.463 0-2.928 2.385-5.43 6.14-5.43h4.533l-1.015 5.879c-.189 1.18.024 1.96 1.015 1.96 1.464 0 2.314-2.55 2.314-4.817 0-4.062-2.857-5.998-6.824-5.998-5.478 0-8.595 3.636-8.595 8.1 0 4.415 3.188 6.918 8.241 6.918h5.69v2.101zm-3.282-8.595c0 1.417.85 2.29 2.314 2.29 1.865 0 2.763-1.723 3.022-3.163l.449-2.645h-2.338c-2.196 0-3.447 1.724-3.447 3.518"/></svg>';

const parse = (raw) => { try { return JSON.parse(raw || 'null'); } catch { return null; } };

function heatmap(activity) {
  if (!Array.isArray(activity) || activity.length === 0) return '';
  const cells = activity.map((n) => {
    const v = Math.min(4, Number(n) || 0);
    return `<i class="h${v}"></i>`;
  }).join('');
  const total = activity.reduce((a, b) => a + (Number(b) || 0), 0);
  return `<div class="heat-body">
      <div class="heat-days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
      <div class="heat">${cells}</div>
    </div>
    <div class="heat-foot"><span class="tnum">${fmt(total)} Matches Played</span>
      <span class="legend"><i class="h1"></i>1 match<i class="h3"></i>+5 matches</span></div>`;
}

function match_rows(recent) {
  return recent.map((m) => `<a class="mrow" href="${esc(m.url || '#')}" ${m.url ? 'target="_blank" rel="noopener nofollow"' : ''}>
      <span class="m-date">${esc(m.day)}<small>${esc(m.time)}</small></span>
      <span class="m-score"><span class="res ${m.result === 'W' ? 'w' : 'l'}">${esc(m.result)}</span><span class="pts tnum">${esc(m.score)}</span></span>
      <span class="m-rating"><b class="tnum">${esc(m.rating ?? '—')}</b><small class="tnum">${esc(m.kda ?? '')}</small></span>
      <span class="m-map">${m.map_icon ? `<img class="map-ico" src="${esc(m.map_icon)}" alt="" referrerpolicy="no-referrer">` : '<span class="map-dot"></span>'}${esc(m.map ?? '')}</span>
    </a>`).join('');
}

// The FaceitRating widgets of the live perf card: a progress bar under the value and
// a 62x40 sparkline of the rating series.
function rating_bar(v) {
  const n = Number(v);
  const w = Number.isFinite(n) ? Math.round(Math.max(0, Math.min(1, n / 1.5)) * 88) : 0;
  return `<svg width="88" height="4" aria-hidden="true"><rect width="88" height="4" rx="2" fill="#333"></rect>${w ? `<rect width="${w}" height="4" rx="2" fill="#f50"></rect>` : ''}</svg>`;
}

function rating_spark(series) {
  const pts = (Array.isArray(series) ? series : []).map(Number).filter(Number.isFinite);
  if (pts.length < 2) return '';
  const min = Math.min(...pts); const max = Math.max(...pts); const span = max - min || 1;
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1) * 58 + 2).toFixed(1)},${(36 - ((v - min) / span) * 32).toFixed(1)}`).join('');
  return `<svg class="rating-spark" viewBox="0 0 62 40" width="62" height="40" aria-hidden="true"><path d="${d}" fill="none" stroke="#fff" stroke-width="2"/></svg>`;
}

function chart_svg(history) {
  // A handful of points with gaps between them reads as a glitch, not a trend.
  if (!Array.isArray(history) || history.length < 10) return '';
  const w = 1000; const h = 160;
  const min = Math.min(...history); const max = Math.max(...history);
  const span = max - min || 1;
  const pts = history.map((v, i) => [ (i / (history.length - 1)) * w, h - 12 - ((v - min) / span) * (h - 32) ]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  // The live chart is a bare line on the card surface; no area fill.
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ff4b00" stop-opacity=".35"/><stop offset="1" stop-color="#ff4b00" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#chartFill)"/>
      <path d="${line}" fill="none" stroke="#ff4b00" stroke-width="2" vector-effect="non-scaling-stroke"/>
    </svg>`;
}

export function faceit_page({ m, base }) {
  const verified = Boolean(m.verified);
  const shown = m.display_override || m.alias || m.current_nickname;
  const initials = esc((shown || '?').trim().slice(0, 2).toUpperCase());
  const stats = parse(m.stats_json) || {};
  const partner = m.partner_id ? { nick: m.partner_nickname, avatar: m.partner_avatar } : null;
  const dest_host = m.destination_type === 'external' && m.destination_url
    ? (() => { try { return new URL(m.destination_url).hostname; } catch { return ''; } })()
    : '';
  const faceit_url = `https://www.faceit.com/en/players/${encodeURIComponent(m.current_nickname)}`;
  const has_matches = Array.isArray(stats.recent) && stats.recent.length > 0;
  // Avg skill level of Match: the chip prints the mean ELO of the sampled matches,
  // not the player's current elo (live page shows 2,108 next to 2,144).
  const avg_elo = Array.isArray(stats.history) && stats.history.length
    ? fmt(Math.round(stats.history.reduce((a, b) => a + (Number(b) || 0), 0) / stats.history.length))
    : (m.elo != null ? fmt(m.elo) : '—');
  const has_heat = Array.isArray(stats.activity) && stats.activity.length > 0;
  const since = stats.since || new Date(m.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const chip = partner && partner.avatar
    ? `<img src="${esc(partner.avatar)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="dock-initials">${esc(((partner?.nick || shown) || '?').slice(0, 2).toUpperCase())}</span>`;

  return `<nav class="rail" aria-label="Main">
    <a class="rail-logo" href="${faceit_url}" target="_blank" rel="noopener nofollow" aria-label="FACEIT">${icon('logo')}</a>
    <span class="rail-item rail-box" title="Search">${icon('search')}<span>Search</span></span>
    <span class="rail-item rail-box" title="CS2"><span class="rail-game">CS2</span><span>CS2</span></span>
    <span class="rail-item" title="Party Finder">${icon('party')}<span>Party Finder</span></span>
    <span class="rail-item" title="Play">${icon('play')}<span>Play</span></span>
    <span class="rail-item" title="Rank">${icon('rank')}<span>Rank</span></span>
    <span class="rail-item" title="Track">${icon('track')}<span>Track</span></span>
    <span class="rail-item" title="Feed">${icon('feed')}<span>Feed</span></span>
    <span class="rail-sep" role="separator"></span>
    <span class="rail-item" title="Clubs">${icon('clubs')}<span>Clubs</span></span>
    <span class="rail-item" title="Create a Club">${icon('create')}<span>Create a Club</span></span>
    <span class="rail-gap"></span>
    <span class="rail-item" title="Missions">${icon('missions')}<span>Missions</span></span>
    <span class="rail-item" title="Shop">${icon('shop')}<span>Shop</span></span>
    <span class="rail-item rail-premium" title="Upgrade">${icon('upgrade')}<span>Upgrade</span></span>
  </nav>

  <aside class="dock" aria-label="Account">
    <a class="dock-avatar" href="${faceit_url}" target="_blank" rel="noopener nofollow" title="${esc(m.current_nickname)}">${chip}</a>
    <span class="dock-ic" title="Matches">${icon('matches')}</span>
    <span class="dock-ic" title="Notifications">${icon('bell')}</span>
    <span class="dock-ic" title="Social">${icon('social')}</span>
    <span class="dock-ic" title="Settings">${icon('settings')}</span>
    <span class="dock-ic" title="Help">${icon('help')}</span>
  </aside>

  <div class="frame">
    <div class="layout">
      <aside class="side">
        <article class="pcard">
          <div class="pcard-in">
            ${stats.cover ? `<img class="card-cover" src="${esc(stats.cover)}" alt="" referrerpolicy="no-referrer">` : ''}
            <div class="avatar-wrap">
              ${m.avatar
                ? `<img src="${esc(m.avatar)}" alt="" referrerpolicy="no-referrer">`
                : `<span class="initials">${initials}</span>`}
              ${level_plate(m.skill_level)}
            </div>
            <h1 data-testid="alias" title="aka ${esc(m.current_nickname)}">${esc(shown)}</h1>
          </div>
          <div class="pcard-actions">
            <a class="btn-friend" href="/players/${esc(m.id)}/go" data-testid="destination-link">${PLUS}ADD FRIEND</a>
            <span class="icon-btn" title="More">${DOTS}</span>
          </div>
          ${dest_host
            ? `<p class="friend-note visually-hidden" data-testid="destination-note">Opens ${esc(dest_host)}${esc(new URL(m.destination_url).pathname)}</p>`
            : `<p class="friend-note visually-hidden" data-testid="destination-note">Opens faceit.com</p>`}
        </article>

        <div class="giftbox">
          <div class="gift-row">${GIFT}<span>Gift A Sub</span><span class="gift-btn">Gift Sub</span></div>
        </div>

        <div class="bio">
          <p class="since">Member since ${esc(since)}</p>
          <p class="about">${stats.about ? esc(stats.about) : `We don't know anything about ${esc(m.current_nickname)}`}</p>
          <p class="country">${flag(m.country)} <span>${esc(country_name(m.country))}</span></p>
        </div>

        <section class="block">
          <h2>Game history</h2>
          <a class="game-row" href="${faceit_url}" target="_blank" rel="noopener nofollow">
            <span class="game-ico">CS2</span>
            <span class="game-id"><b>CS2</b><span class="tnum">${stats.matches ? `${fmt(stats.matches)} matches` : 'no matches'}</span></span>
            <span class="game-arrow">›</span>
          </a>
        </section>

        ${has_heat ? `<section class="block">
          <div class="block-head"><h2>Recent Activity</h2><span>Last 90 days</span></div>
          ${heatmap(stats.activity)}
        </section>` : ''}
        <section class="guestbook">
          <div class="gb-head"><h2>Guestbook (0)</h2></div>
          <div class="gb-empty">
            ${AT_ICON}
            <h5>The guestbook is empty</h5>
            <span>No posts yet</span>
          </div>
        </section>
      </aside>

      <div class="main">
        <nav class="tabs" aria-label="Profile sections">
          <a class="is-active" href="#top">GAMES</a>
          <a href="#top">FRIENDS</a>
          <a href="#top">VIDEOS</a>
          <a href="#top">GUESTBOOK</a>
          <a href="#top">INVENTORY</a>
          <a href="#top">CLUBS</a>
          <a href="#top">TEAMS</a>
        </nav>

        <div class="gamebar">
          <span class="game-pill"><span class="game-ico">CS2</span>CS2</span>
          <div class="subtabs">
            <a class="is-active" href="#top">Summary</a>
            <a href="#top">Match history</a>
            <a href="#top">Matchmaking</a>
            <a href="#top">Leagues</a>
            <a href="#top">Tournaments</a>
          </div>
          <span class="gamebar-grid">${icon('grid')}</span>
        </div>

        <div class="stack">
          <section class="season" aria-labelledby="season-title" data-level="${Math.max(0, Math.min(10, Math.floor(Number(m.skill_level) || 0)))}">
            <div class="season-head">
              <span class="season-ico">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="3.4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>
              </span>
              <div class="season-titles">
                <span class="season-title" id="season-title">Season 9</span>
                <span class="season-sub">Matchmaking</span>
              </div>
              <a class="season-link" href="${faceit_url}" target="_blank" rel="noopener nofollow">Season 9 stats</a>
            </div>
            <div class="season-body">
              ${skill_badge(m.skill_level, 64, m.elo)}
              <span class="season-elo tnum" data-testid="elo">${m.elo != null ? fmt(m.elo) : 'Unranked'}</span>
              <div class="season-right">
                ${(stats.country_rank || stats.region_rank) ? `
                <div class="season-ranks">
                  ${stats.country_rank ? `<span class="rankpill"><span class="rp-flag">${flag(m.country)}</span><b class="tnum">${fmt(stats.country_rank)}</b></span>` : ''}
                  ${stats.region_rank ? `<span class="rankpill"><span class="rp-ico">${REGION_ICONS[String(stats.region || 'EU').toUpperCase()] ?? GLOBE}</span><b class="tnum">${fmt(stats.region_rank)}</b></span>` : ''}
                </div>` : ''}
                <div class="season-tally"><b class="tnum">${(stats.season_matches ?? stats.matches) != null ? fmt(stats.season_matches ?? stats.matches) : '—'}</b> Matches <span class="dot">•</span> <b class="tnum">${(stats.season_winrate ?? stats.winrate) != null ? `${stats.season_winrate ?? stats.winrate}%` : '—'}</b> Win rate</div>
              </div>
            </div>
          </section>

          <section class="perf" aria-labelledby="perf-title">
            <div class="perf-head">
              <h2 id="perf-title">Recent performance</h2>
              <div class="perf-head-right">
                <span>Last <b>30</b> Matches</span>
                <span class="chip">${skill_badge(m.skill_level, 16, avg_elo)}<b class="tnum">${esc(avg_elo)}</b> Avg skill level of Match</span>
              </div>
            </div>
            <div class="perf-row">
              <span class="muted">Elo change</span>
              <b class="tnum ${String(stats.elo_change || '').trim().startsWith('-') ? 'neg' : 'green'}">${stats.elo_change ?? '—'}</b>
              <span class="wl">
                <span class="sq w">W</span><b class="tnum">${stats.wins_recent ?? stats.wins ?? '—'}</b>
                <span class="sq l">L</span><b class="tnum">${stats.losses_recent ?? stats.losses ?? '—'}</b>
              </span>
            </div>
            ${chart_svg(stats.history)}
            <div class="perf-body">
              <div class="rating-box">
                ${MEDAL}
                <div class="rating-num">
                  <span class="rating-value tnum">${esc(stats.avg_rating ?? '—')}</span>
                  ${rating_bar(stats.avg_rating)}
                </div>
                ${rating_spark(stats.rating_history)}
              </div>
              <div class="rating-bottom">
                <span class="rrow"><span>Swing</span><b>${esc(stats.rating_swing ?? '—')}</b></span>
                <span class="rrow"><span>Consistency</span><b>${esc(stats.rating_consistency ?? '—')}</b></span>
              </div>
              <div class="perf-grid">
                <div class="cell"><b class="tnum">${esc(stats.kda ?? '—')}</b><span>K/D/A</span></div>
                <div class="cell"><b class="tnum">${stats.kd ?? '—'}</b><span>K/D</span></div>
                <div class="cell"><b class="tnum">${stats.kr ?? '—'}</b><span>K/R</span></div>
                <div class="cell"><b class="tnum">${stats.hs ? `${stats.hs}%` : '—'}</b><span>HS%</span></div>
                <div class="cell"><b class="tnum">${stats.adr ?? '—'}</b><span>ADR</span></div>
                <div class="cell"><b class="tnum">${(stats.winrate_recent ?? stats.winrate) ? `${stats.winrate_recent ?? stats.winrate}%` : '—'}</b><span>Win rate</span></div>
              </div>
            </div>
          </section>

          ${has_matches ? `<div class="matches" aria-labelledby="matches-title">
            <div class="matches-head"><h2 id="matches-title">Recent matches</h2>
              <a href="${faceit_url}" target="_blank" rel="noopener nofollow">Full match history <span>›</span></a></div>
            <div class="mtable">
              <div class="mhead"><span>Date</span><span>Score</span><span>Rating</span><span>Map</span></div>
              ${match_rows(stats.recent)}
            </div>
          </div>` : ''}
        </div>

        <footer class="pfoot">
          <p class="meta"><span class="mono">${esc(m.id)}</span> · data read ${new Date(m.created_at || Date.now()).toISOString().slice(0, 10)}</p>
        </footer>
      </div>
    </div>
    <script src="/public.js" defer></script>
  </div>`;
}

const COUNTRIES = {
  rs: 'Serbia', fr: 'France', de: 'Germany', us: 'United States', ru: 'Russian Federation',
  ua: 'Ukraine', pl: 'Poland', se: 'Sweden', gb: 'United Kingdom', br: 'Brazil',
};
function country_name(cc) { return COUNTRIES[String(cc || '').toLowerCase()] || (cc ? String(cc).toUpperCase() : '—'); }
