import React from 'react';
import PropTypes from 'prop-types';

// Group chat UI component
const Chat = ({ messages, inputText, setInputText, handleSendMessage, peerId }) => {
  console.log('[Chat] Rendering with messages:', messages);

  const safeMessages = Array.isArray(messages) ? messages : [];

  return (
    <div className="chat-container">
      <style>
        {`
          .chat-container {
            display: flex;
            flex-direction: column;
            gap: 16px;
            flex-grow: 1;
            width: 100%;
          }

          .chat-messages {
            flex-grow: 1;
            overflow-y: auto;
            padding: 8px;
            margin-bottom: 70px;
          }

          .message-container {
            display: flex;
            flex-direction: column;
            margin: 4px 0;
          }

          .message-container-self {
            align-items: flex-end;
            margin-bottom: 2px;
          }

          .message-container-other {
            align-items: flex-start;
            margin-bottom: 2px;
          }

          .message {
            max-width: 70%;
            padding-left: 10px;
            padding-right: 10px;
            padding-bottom: 8.5px;
            padding-top: 10px;
            border-radius: 12px;
            font-size: 19px;
            font-weight: 500;
            line-height: 25px;
            color: #FFFFFF;
          }

          .message-self {
            background-color: #10B981;
            margin-left: calc(2% + 8px);
            margin-right: 1px;
            margin-bottom: 2px;
            padding-left: calc(10% + 8px);
          }

          .message-other {
            background-color: #343541;
            margin-right: calc(2% + 8px);
            margin-left: 1px;
            margin-bottom: 2px;
            padding-right: calc(25% + 8px);
          }

          .message-sender-self {
            text-align: right;
            color: #D1D5DB;
            font-size: 12px;
            font-weight: 600;
            margin-right: 5px;
            margin-bottom: 3px;
          }

          .message-sender-other {
            text-align: left;
            color: #D1D5DB;
            font-size: 12px;
            font-weight: 600;
            margin-left: 5px;
            margin-bottom: 3px;
          }

          .chat-input-container {
            position: fixed;
            bottom: 16px;
            width: calc(95% - 16px);
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 8px;
          }

          .chat-input {
            flex: 1;
            background-color: #343541;
            color: #FFFFFF;
            border: 1px solid #4B5563;
            border-radius: 8.8px;
            padding: 8.8px 13.2px;
            font-size: 17.6px;
            outline: none;
          }

          .chat-input::placeholder {
            color: #6B7280;
          }

          .bt {
            border: none;
            user-select: none;
            font-size: 20px;
            font-weight: 600;
            color: white;
            text-align: center;
            background-color: #00A97F;
            box-shadow: #171717 2.2px 2.2px 11px 1.1px;
            border-radius: 13.2px;
            height: 50px;
            line-height: 50px;
            width: 120.5px;
            transition: all 0.2s ease;
            position: relative;
            font-family: 'Inter', sans-serif;
          }

          .msg {
            height: 0;
            width: 0;
            border-radius: 2.2px;
            position: absolute;
            left: 15%;
            top: 25%;
          }

          .bt:active {
            transition: all 0.001s ease;
            background-color: #0ec496;
            box-shadow: grey 0 0 0 0;
            transform: translateX(1.1px) translateY(1.1px);
          }

          .bt:hover .msg {
            animation: msgRun 2s forwards;
          }

          @keyframes msgRun {
            0% {
              border-top: #d6d6d9 0 solid;
              border-bottom: #f2f2f5 0 solid;
              border-left: #f2f2f5 0 solid;
              border-right: #f2f2f5 0 solid;
            }
            20% {
              border-top: #d6d6d9 15.4px solid;
              border-bottom: #f2f2f5 15.4px solid;
              border-left: #f2f2f5 22px solid;
              border-right: #f2f2f5 22px solid;
            }
            25% {
              border-top: #d6d6d9 13.2px solid;
              border-bottom: #f2f2f5 13.2px solid;
              border-left: #f2f2f5 19.8px solid;
              border-right: #f2f2f5 19.8px solid;
            }
            80% {
              border-top: transparent 13.2px solid;
              border-bottom: transparent 13.2px solid;
              border-left: transparent 19.8px solid;
              border-right: transparent 19.8px solid;
            }
            100% {
              transform: translateX(165px);
              border-top: transparent 13.2px solid;
              border-bottom: transparent 13.2px solid;
              border-left: transparent 19.8px solid;
              border-right: transparent 19.8px solid;
            }
          }
        `}
      </style>
      <div className="chat-messages">
        {safeMessages.map((msg) => (
          <div
            key={msg.id}
            className={`message-container ${msg.sender === peerId ? 'message-container-self' : 'message-container-other'}`}
          >
            <div className={msg.sender === peerId ? 'message-sender-self' : 'message-sender-other'}>
              {msg.sender === peerId ? 'You' : msg.sender}
            </div>
            <div className={`message ${msg.sender === peerId ? 'message-self' : 'message-other'}`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>
      <div className="chat-input-container">
        <input
          type="text"
          className="chat-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
        />
        <button
          className="bt"
          onClick={handleSendMessage}
        >
          <span className="msg"></span>
          SEND
        </button>
      </div>
    </div>
  );
};

Chat.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
      text: PropTypes.string,
      sender: PropTypes.string,
    })
  ),
  inputText: PropTypes.string.isRequired,
  setInputText: PropTypes.func.isRequired,
  handleSendMessage: PropTypes.func.isRequired,
  peerId: PropTypes.string.isRequired,
};

Chat.defaultProps = {
  messages: [],
};

export default Chat;