"""Run externally (Task Scheduler, cron, or container scheduler). Never sleeps forever in Streamlit."""
import logging
from .alerts import AlertService, TelegramChannel, OfficialKakaoChannel
from .repository import Repository
from .data_provider import SampleProvider
from .monitor import position_events
from .briefing import send_morning_brief

def run_once():
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    provider=SampleProvider(); prices={x.code:x.price for x in provider.snapshots()}; service=AlertService(Repository(),[TelegramChannel(),OfficialKakaoChannel()])
    for row in Repository().watchlist():
        for event in position_events(row,prices.get(row[0],row[2])): service.dispatch(event)
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('--morning-brief',action='store_true')
    args=parser.parse_args()
    if args.morning_brief:
        logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
        logging.info('morning briefing delivered to: %s', send_morning_brief())
    else:
        run_once()
